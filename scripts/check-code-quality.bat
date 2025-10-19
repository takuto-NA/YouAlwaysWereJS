@echo off
REM ============================================================================
REM このファイルの役割: Windows環境でコーディングルールに準拠しているかを自動チェック
REM ============================================================================

echo ==================================================
echo Code Quality Check - YouAlwaysWereJS (Windows)
echo ==================================================
echo.

set TOTAL_ISSUES=0

REM ============================================================================
REM 1. TypeScript型チェック
REM ============================================================================
echo [1/4] TypeScript type check...
call npx tsc --noEmit >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] TypeScript type errors found
    call npx tsc --noEmit
    set /a TOTAL_ISSUES+=1
) else (
    echo [OK] No TypeScript type errors
)
echo.

REM ============================================================================
REM 2. ESLintチェック（設定されている場合）
REM ============================================================================
echo [2/4] Checking for linting issues...
if exist ".eslintrc.json" (
    call npx eslint src/ --ext .ts,.tsx >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [WARNING] Linting issues found
        call npx eslint src/ --ext .ts,.tsx
        set /a TOTAL_ISSUES+=1
    ) else (
        echo [OK] No linting issues
    )
) else (
    echo [SKIP] ESLint not configured
)
echo.

REM ============================================================================
REM 3. package.jsonのチェック
REM ============================================================================
echo [3/4] Checking package.json...
if exist "package.json" (
    findstr /C:"\"type\": \"module\"" package.json >nul
    if %ERRORLEVEL% EQU 0 (
        echo [OK] ES module configuration found
    ) else (
        echo [WARNING] Consider using ES modules
    )
) else (
    echo [ERROR] package.json not found
    set /a TOTAL_ISSUES+=1
)
echo.

REM ============================================================================
REM 4. 依存関係のチェック
REM ============================================================================
echo [4/4] Checking dependencies...
if exist "node_modules" (
    echo [OK] Dependencies installed
) else (
    echo [WARNING] node_modules not found - run 'npm install'
    set /a TOTAL_ISSUES+=1
)
echo.

REM ============================================================================
REM 結果サマリー
REM ============================================================================
echo ==================================================
echo Summary
echo ==================================================

if %TOTAL_ISSUES% EQU 0 (
    echo [SUCCESS] All checks passed! Code quality is good.
    exit /b 0
) else (
    echo [WARNING] Found %TOTAL_ISSUES% potential issues.
    echo Please review and fix these issues before committing.
    exit /b 1
)

#!/bin/bash

###############################################################################
# このファイルの役割: コーディングルールに準拠しているかを自動チェック
# CI/CDパイプラインやコミット前に実行することで、コード品質を保証
###############################################################################

echo "=================================================="
echo "Code Quality Check - YouAlwaysWereJS"
echo "=================================================="
echo ""

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TOTAL_ISSUES=0

###############################################################################
# 1. マジックナンバーチェック
###############################################################################
echo "🔍 [1/7] Checking for magic numbers..."
MAGIC_NUMBERS=$(grep -rn --include="*.ts" --include="*.tsx" -E "[^a-zA-Z_][0-9]{2,}[^a-zA-Z_0-9]" src/ | \
    grep -v "// @ignore-magic-number" | \
    grep -v "gameConfig.ts" | \
    grep -v "className=" | \
    grep -v 'className="' | \
    grep -v "style=" | \
    grep -v "/24/" | \
    grep -v "/outline" | \
    grep -v "animationDelay" | \
    grep -v "setTimeout" || true)

if [ -n "$MAGIC_NUMBERS" ]; then
    echo -e "${YELLOW}⚠️  Magic numbers found (excluding Tailwind/Heroicons):${NC}"
    echo "$MAGIC_NUMBERS"
    TOTAL_ISSUES=$((TOTAL_ISSUES + $(echo "$MAGIC_NUMBERS" | wc -l)))
else
    echo -e "${GREEN}✅ No magic numbers (excluding Tailwind/Heroicons)${NC}"
fi
echo ""

###############################################################################
# 2. console.logチェック（本番前に削除すべき）
###############################################################################
echo "🔍 [2/7] Checking for console.log..."
CONSOLE_LOGS=$(grep -rn --include="*.ts" --include="*.tsx" "console\.log" src/ | \
    grep -v "logDebug\|logError\|logWarning" | \
    grep -v "errorHandler.ts" || true)

if [ -n "$CONSOLE_LOGS" ]; then
    echo -e "${YELLOW}⚠️  console.log found (should use logDebug/logError/logWarning):${NC}"
    echo "$CONSOLE_LOGS"
    TOTAL_ISSUES=$((TOTAL_ISSUES + $(echo "$CONSOLE_LOGS" | wc -l)))
else
    echo -e "${GREEN}✅ No raw console.log (errorHandler.ts excluded)${NC}"
fi
echo ""

###############################################################################
# 3. 省略された変数名チェック（3文字以下）
###############################################################################
echo "🔍 [3/7] Checking for abbreviated variable names..."
ABBREVIATED=$(grep -rn --include="*.ts" --include="*.tsx" -E "(const|let|var)\s+[a-z]{1,3}\s*=" src/ | grep -v "// @allow-short-name" || true)

if [ -n "$ABBREVIATED" ]; then
    echo -e "${RED}❌ Abbreviated variable names found (should be descriptive):${NC}"
    echo "$ABBREVIATED"
    TOTAL_ISSUES=$((TOTAL_ISSUES + $(echo "$ABBREVIATED" | wc -l)))
else
    echo -e "${GREEN}✅ No abbreviated variable names${NC}"
fi
echo ""

###############################################################################
# 4. try-catchなしのasync関数チェック
###############################################################################
echo "🔍 [4/7] Checking for async functions without try-catch..."
ASYNC_NO_TRY=$(grep -rn --include="*.ts" --include="*.tsx" -A10 "async.*{" src/ | grep -v "try\|catch" | grep "async" || true)

if [ -n "$ASYNC_NO_TRY" ]; then
    echo -e "${YELLOW}⚠️  Async functions without try-catch (potential error handling issue):${NC}"
    echo "$ASYNC_NO_TRY" | head -20
    TOTAL_ISSUES=$((TOTAL_ISSUES + $(echo "$ASYNC_NO_TRY" | wc -l)))
else
    echo -e "${GREEN}✅ All async functions have error handling${NC}"
fi
echo ""

###############################################################################
# 5. 暗黙的any型チェック
###############################################################################
echo "🔍 [5/7] Checking for implicit 'any' type..."
IMPLICIT_ANY=$(grep -rn --include="*.ts" --include="*.tsx" ": any" src/ || true)

if [ -n "$IMPLICIT_ANY" ]; then
    echo -e "${YELLOW}⚠️  Implicit 'any' type found (should use explicit types):${NC}"
    echo "$IMPLICIT_ANY"
    TOTAL_ISSUES=$((TOTAL_ISSUES + $(echo "$IMPLICIT_ANY" | wc -l)))
else
    echo -e "${GREEN}✅ No implicit 'any' types${NC}"
fi
echo ""

###############################################################################
# 6. TODO/FIXMEコメントチェック
###############################################################################
echo "🔍 [6/7] Checking for TODO/FIXME comments..."
TODOS=$(grep -rn --include="*.ts" --include="*.tsx" "TODO\|FIXME\|HACK" src/ || true)

if [ -n "$TODOS" ]; then
    echo -e "${YELLOW}⚠️  TODO/FIXME comments found:${NC}"
    echo "$TODOS"
    echo -e "${YELLOW}(These should be addressed before release)${NC}"
else
    echo -e "${GREEN}✅ No TODO/FIXME comments${NC}"
fi
echo ""

###############################################################################
# 7. TypeScript型チェック
###############################################################################
echo "🔍 [7/7] Running TypeScript type check..."
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    echo -e "${RED}❌ TypeScript type errors found${NC}"
    npx tsc --noEmit
    TOTAL_ISSUES=$((TOTAL_ISSUES + 1))
else
    echo -e "${GREEN}✅ No TypeScript type errors${NC}"
fi
echo ""

###############################################################################
# 結果サマリー
###############################################################################
echo "=================================================="
echo "Summary"
echo "=================================================="

if [ $TOTAL_ISSUES -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Code quality is good.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Found $TOTAL_ISSUES potential issues.${NC}"
    echo -e "${YELLOW}Please review and fix these issues before committing.${NC}"
    exit 1
fi

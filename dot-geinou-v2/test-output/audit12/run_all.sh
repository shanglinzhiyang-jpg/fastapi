#!/bin/sh
# One-command regression check for dot-geinou-v2. Usage: sh run_all.sh [--quick]
# Needs the test server: python3 -m http.server 8766 --directory <repo root>
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
GAME_URL=${GAME_URL:-http://localhost:8766/}
export GAME_URL
OUT=$ROOT/test-output/audit12/out; mkdir -p "$OUT"
SUM=$OUT/summary.txt; : > "$SUM"
row() { printf '%-34s %s\n' "$1" "$2" | tee -a "$SUM"; }

# 1. every module parses
bad=0
for f in $(find "$ROOT/js" -name '*.js'); do node --check "$f" 2>/dev/null || { bad=$((bad+1)); echo "syntax: $f" >> "$SUM"; }; done
row "syntax (js/**/*.js)" "$([ $bad = 0 ] && echo PASS || echo "FAIL ($bad)")"

# 2. server up
curl -s -o /dev/null "$GAME_URL" && row "test server" "PASS" || { row "test server" "FAIL (start it first)"; exit 1; }

# 3. browser: 世界情勢 history of every regime, long run of the 歴史の列強
cd "$ROOT/test-output" || exit 1
node progress/r14h/t6.mjs heisei all > "$OUT/hist_all.txt" 2>&1
grep -q 'errs": \[\]' "$OUT/hist_all.txt" && grep -q 'errors \[\]' "$OUT/hist_all.txt" && row "regimes: 3300 days, heisei" PASS || row "regimes: 3300 days, heisei" "FAIL (see $OUT/hist_all.txt)"

# 4. long mixed play with all regimes on (240 days reiwa is the slow one; skip with --quick)
cd "$ROOT/test-output/audit6/systems" || exit 1
if [ "$1" = "--quick" ]; then
  node longhist.mjs heisei 120 > "$OUT/long_heisei.txt" 2>&1
else
  node longhist.mjs reiwa 240 > "$OUT/long_reiwa.txt" 2>&1
fi
f=$OUT/long_heisei.txt; [ "$1" = "--quick" ] || f=$OUT/long_reiwa.txt
e=$(grep -E '^errors' "$f" | tail -1); fl=$(grep -E '^flood' "$f" | head -1)
row "long play (${1:-full})" "$e"
row "morning message flood" "${fl:-n/a}"

# 5. [R16] the same long run with a car (loan, monthly bills, 車検): no errors, no flood
if [ "$1" = "--quick" ]; then
  CAR=1 node longhist.mjs heisei 120 > "$OUT/long_heisei_car.txt" 2>&1
  e=$(grep -E '^errors' "$OUT/long_heisei_car.txt" | tail -1); fl=$(grep -E '^flood' "$OUT/long_heisei_car.txt" | head -1)
  row "long play with a car (--quick)" "$e"
  row "  its morning message flood" "${fl:-n/a}"
fi
# 6. [R17] 独裁の統治（クーデター・摘発・後継・死去・崩壊）と、戦時の国内（司令官・軍需・政策・反戦運動）
cd "$ROOT" || exit 1
for t in rule_t1 war_t1; do
  node test-output/progress/r17/$t.mjs > "$OUT/r17_$t.txt" 2>&1
  row "R17 $t" "$(tail -1 "$OUT/r17_$t.txt")"
done
echo "---- details: $OUT" | tee -a "$SUM"

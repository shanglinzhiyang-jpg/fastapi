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
# 7. [R18] スキャンダルの展開（報道・続報・捜査・起訴・判決・本人の対応）
node test-output/progress/r18/scandal_t1.mjs > "$OUT/r18_scandal_t1.txt" 2>&1
row "R18 scandal_t1" "$(tail -1 "$OUT/r18_scandal_t1.txt")"
# 8. [R19] 選挙制度と区割り（一票の格差・最高裁の判決・ゲリマンダー・足切り・配分）
node test-output/progress/r19/election_t1.mjs > "$OUT/r19_election_t1.txt" 2>&1
row "R19 election_t1" "$(tail -1 "$OUT/r19_election_t1.txt")"
# 9. [R20] 地方政治（予算・条例・議会・借金・不信任・住民投票・国の要請）
node test-output/progress/r20/local_t1.mjs > "$OUT/r20_local_t1.txt" 2>&1
row "R20 local_t1" "$(tail -1 "$OUT/r20_local_t1.txt")"
# 10. [R21] 派閥と政治資金パーティー（ノルマ・キックバック・露見・解散・申し出への答え）
node test-output/progress/r21/fm_t1.mjs > "$OUT/r21_fm_t1.txt" 2>&1
row "R21 fm_t1" "$(tail -1 "$OUT/r21_fm_t1.txt")"
# 11. [R24] 世論操作とメディア戦略（関係・広報・ステマ/デマ/調査の誘導とその発覚・週刊誌の取材）
node test-output/progress/r24/media_t1.mjs > "$OUT/r24_media_t1.txt" 2>&1
row "R24 media_t1" "$(tail -1 "$OUT/r24_media_t1.txt")"
# 12. [R25] 独裁崩壊後の亡命と裁判（責任の重さ・行き先・判決・シーンの全経路・既存の終わり方）
node test-output/progress/r25/exile_t1.mjs > "$OUT/r25_exile_t1.txt" 2>&1
row "R25 exile_t1" "$(tail -1 "$OUT/r25_exile_t1.txt")"
# 13. [R26] 感染症とサイバー攻撃（流行の力学・行動制限・身代金・公表・立場ごとの権限・政府の自動対応・2020年）
node test-output/progress/r26/crisis_t1.mjs > "$OUT/r26_crisis_t1.txt" 2>&1
row "R26 crisis_t1" "$(tail -1 "$OUT/r26_crisis_t1.txt")"
# 14. [R27] 国会戦術（会期延長・牛歩戦術・問責決議、NPCの使い方）
node test-output/progress/r27/diet_t1.mjs > "$OUT/r27_diet_t1.txt" 2>&1
row "R27 diet_t1" "$(tail -1 "$OUT/r27_diet_t1.txt")"
# 15. [R28] 通し検査（R17–R27）: 昭和の時代設定（ネットなし）、全システムを埋めてセーブ→再読み込みして比較、用語集の時代チェック
node test-output/progress/r28/era_t1.mjs > "$OUT/r28_era_t1.txt" 2>&1
row "R28 era_t1 (showa: no net)" "$(tail -1 "$OUT/r28_era_t1.txt")"
node test-output/progress/r28/audit_save.mjs heisei > "$OUT/r28_audit_save.txt" 2>&1
row "R28 save/reload audit" "$(tail -1 "$OUT/r28_audit_save.txt")"
node test-output/fix3-learning/gloss_era.mjs > "$OUT/r28_gloss_era.txt" 2>&1
row "R28 glossary era check" "$(tail -1 "$OUT/r28_gloss_era.txt")"
# 16. [R29] ミニゲームの中身をふやした（クイズ・ツッコミ・トーク・原稿読み・大喜利・漫才・コント・ズッコケ・感情演技）
node test-output/progress/r29/mg_t1.mjs > "$OUT/r29_mg_t1.txt" 2>&1
row "R29 minigame content" "$(tail -1 "$OUT/r29_mg_t1.txt")"
echo "---- details: $OUT" | tee -a "$SUM"

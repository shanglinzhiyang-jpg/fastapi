audit12 — one-command regression check
======================================
1. Start the test server (once):  cd <repo root> && python3 -m http.server 8766 --directory .
2. Run:                           sh test-output/audit12/run_all.sh           (about 10 minutes)
                                  sh test-output/audit12/run_all.sh --quick   (about 3 minutes)
3. Read the summary table printed at the end and the files in test-output/audit12/out/.

Checks: syntax of every module; the 歴史の列強 (all five regimes through their histories, heisei);
a long mixed play with all regimes on (heisei 120 days, or reiwa 240 days without --quick), with its error count and
morning message flood; with --quick also the same long run where the player owns a car (R16: loan, monthly bills, 車検).
Also (R17): the dictatorship's rule (test-output/progress/r17/rule_t1.mjs: pillars, purges, plots, succession, death, downfall, old saves) and the war at home
(war_t1.mjs: commanders, production, policies, the anti-war movement, the end of the war).
Also (R18): scandal_t1.mjs (the stages of a scandal, the player's answers incl. the cover-up, old saves).
Also (R19): election_t1.mjs (the five election laws, the effect on a real election with the same dice, the Court's rulings, the gerrymander).

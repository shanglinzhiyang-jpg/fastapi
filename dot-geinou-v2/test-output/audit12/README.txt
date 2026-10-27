audit12 — one-command regression check
======================================
1. Start the test server (once):  cd <repo root> && python3 -m http.server 8766 --directory .
2. Run:                           sh test-output/audit12/run_all.sh           (about 10 minutes)
                                  sh test-output/audit12/run_all.sh --quick   (about 3 minutes)
3. Read the summary table printed at the end and the files in test-output/audit12/out/.

Checks: syntax of every module; the 歴史の列強 (all five regimes through their histories, heisei);
a long mixed play with all regimes on (heisei 120 days, or reiwa 240 days without --quick), with its error count and
morning message flood.

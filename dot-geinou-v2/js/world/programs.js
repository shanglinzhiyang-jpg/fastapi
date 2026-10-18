// Real TV programs (titles only; hosts are never depicted) and the station job desk.
// Filled in by the programs pass. Station places call programDesk(g, stationId, npc).

export async function programDesk(g, stationId, npc) {
  await g.say('番組の出演依頼は、ただいま準備中です。', { name: npc ? npc.name : '受付', look: npc ? npc.look : undefined });
}

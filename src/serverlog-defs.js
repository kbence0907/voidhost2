
export const SERVERLOG_EVENTS = [
  { key: 'messageDelete', label: 'Üzenet törlés',        desc: 'Törölt üzenetek naplózása (szöveg, szerző, csatorna).' },
  { key: 'messageEdit',   label: 'Üzenet szerkesztés',   desc: 'Szerkesztett üzenetek naplózása (régi és új szöveg).' },
  { key: 'messageSend',   label: 'Üzenet küldés',        desc: 'Minden elküldött üzenet naplózása. Nagy forgalomnál sok bejegyzést jelent!' },
  { key: 'voice',         label: 'Hangcsatorna mozgás',  desc: 'Belépett, kilépett vagy átment egy másik hangcsatornába.' },
  { key: 'voiceMute',     label: 'Némítás / süketítés',  desc: 'Lenémította / lesüketítette magát, vagy szerver oldali némítás történt.' },
  { key: 'member',        label: 'Tagok',                desc: 'Csatlakozás, kilépés, kitiltás, kitiltás feloldása, becenév változás.' },
  { key: 'memberRoles',   label: 'Tag rangjai',          desc: 'Rangot kapott vagy elvettek tőle egy rangot.' },
  { key: 'roles',         label: 'Rangok',               desc: 'Rang létrehozása, törlése, átnevezése, jogosultságok változása.' },
  { key: 'channels',      label: 'Csatornák',            desc: 'Csatorna létrehozása, törlése, átnevezése.' },
];

export const SERVERLOG_EVENT_KEYS = SERVERLOG_EVENTS.map(e => e.key);

export const SERVERLOG_DEFAULT = {
  channelId: '',
  embedColor: '#5865f2',
  events: Object.fromEntries(SERVERLOG_EVENT_KEYS.map(k => [k, {
    enabled: k !== 'messageSend',
    channelId: '',
  }])),
};

export function mergeServerlogConfig(raw) {
  const out = {
    channelId:  typeof raw?.channelId === 'string' ? raw.channelId : '',
    embedColor: typeof raw?.embedColor === 'string' ? raw.embedColor : SERVERLOG_DEFAULT.embedColor,
    events: {},
  };
  for (const k of SERVERLOG_EVENT_KEYS) {
    const ev = raw?.events?.[k];
    out.events[k] = {
      enabled:   ev ? !!ev.enabled : SERVERLOG_DEFAULT.events[k].enabled,
      channelId: typeof ev?.channelId === 'string' ? ev.channelId : '',
    };
  }
  return out;
}

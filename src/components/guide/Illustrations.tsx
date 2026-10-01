import type { ReactNode } from 'react';

/**
 * Original diagrams and schematic "mock screens" for the setup guide. Diagrams follow the theme
 * tokens; mock screens use fixed colours because they imitate someone else's UI, loosely. They are
 * deliberately generic: real firmware and OS dialogs differ by vendor and version.
 */

function Figure({ label, caption, children }: { label: string; caption?: string; children: ReactNode }) {
  return (
    <figure className="illus">
      <div role="img" aria-label={label}>
        {children}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

const FONT = 'var(--font)';
const MONO = 'var(--mono)';

/* ---------- Step 1: wired vs Wi-Fi ---------- */

function Monitor({ x, y, glow = false }: { x: number; y: number; glow?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="86" height="58" rx="9" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3.5" />
      <rect x="8" y="8" width="70" height="42" rx="4" fill={glow ? 'var(--accent-soft)' : 'var(--surface-2)'} />
      <path d="M30 76h26M43 58v18" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />
    </g>
  );
}

export function WiredVsWifi() {
  return (
    <Figure
      label="Left: a computer connected to a switch by an Ethernet cable, marked as reliable. Right: a computer on Wi-Fi, marked as limited."
      caption="Wired Ethernet keeps the network card powered and listening in sleep and shutdown. Wi-Fi adapters usually cannot do this."
    >
      <svg viewBox="0 0 600 230" focusable="false">
        <rect x="2" y="2" width="290" height="226" rx="22" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="2" />
        <rect x="308" y="2" width="290" height="226" rx="22" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="2" />

        {/* wired */}
        <text x="24" y="38" fontFamily={FONT} fontWeight="800" fontSize="17" fill="var(--ink)">
          Wired Ethernet
        </text>
        <Monitor x={26} y={70} glow />
        <path d="M112 100h34c14 0 14 38 28 38h30" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
        <rect x="204" y="118" width="64" height="40" rx="9" fill="var(--surface-2)" stroke="var(--ink)" strokeWidth="3.5" />
        <path d="M216 138h.01M228 138h.01M240 138h.01M252 138h.01" stroke="var(--accent-text)" strokeWidth="6" strokeLinecap="round" />
        <text x="236" y="178" textAnchor="middle" fontFamily={FONT} fontSize="13" fontWeight="700" fill="var(--muted)">
          switch / router
        </text>
        <circle cx="244" cy="68" r="19" fill="var(--ok)" />
        <path d="M235 68l6 6 11-12" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <text x="24" y="206" fontFamily={FONT} fontSize="13.5" fontWeight="700" fill="var(--ok)">
          Best choice: wakes from sleep and off
        </text>

        {/* wifi */}
        <text x="330" y="38" fontFamily={FONT} fontWeight="800" fontSize="17" fill="var(--ink)">
          Wi-Fi
        </text>
        <Monitor x={332} y={70} />
        <g fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round">
          <path d="M440 100q14 10 0 22" />
          <path d="M452 90q24 21 0 42" />
          <path d="M464 80q34 31 0 62" strokeDasharray="2 9" />
        </g>
        <rect x="506" y="104" width="64" height="40" rx="9" fill="var(--surface-2)" stroke="var(--ink)" strokeWidth="3.5" />
        <path d="M522 104l-8-22M554 104l8-22" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />
        <text x="538" y="168" textAnchor="middle" fontFamily={FONT} fontSize="13" fontWeight="700" fill="var(--muted)">
          access point
        </text>
        <circle cx="550" cy="68" r="19" fill="var(--warn)" />
        <path d="M550 59v11M550 77h.01" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
        <text x="330" y="206" fontFamily={FONT} fontSize="13.5" fontWeight="700" fill="var(--warn)">
          Limited: sleep only, on some devices
        </text>
      </svg>
    </Figure>
  );
}

/* ---------- Step 2: BIOS / UEFI mock ---------- */

export function BiosScreen() {
  const rows: Array<[string, string, 'on' | 'off' | null]> = [
    ['ErP Ready', 'Disabled', 'off'],
    ['Restore AC Power Loss', 'Power Off', null],
    ['Power On By PCI-E', 'Enabled', 'on'],
    ['Power On By RTC', 'Disabled', null],
    ['USB Power in S5', 'Enabled', null],
  ];
  return (
    <Figure
      label="A schematic firmware settings screen listing power options. 'ErP Ready' is set to Disabled and 'Power On By PCI-E' is set to Enabled."
      caption="Schematic example. Your firmware will use different names and layout; look for the words LAN, PCI-E, ErP, Deep Sleep."
    >
      <svg viewBox="0 0 600 300" focusable="false">
        <rect x="2" y="2" width="596" height="296" rx="16" fill="#0f2238" stroke="#2c4a6e" strokeWidth="3" />
        <rect x="2" y="2" width="596" height="40" rx="14" fill="#173352" />
        <text x="22" y="28" fontFamily={MONO} fontSize="15" fontWeight="700" fill="#9fd0ff">
          Advanced  ›  Power Management
        </text>
        <text x="578" y="28" textAnchor="end" fontFamily={MONO} fontSize="13" fill="#6f95bd">
          Illustration
        </text>
        {rows.map(([label, value, mark], i) => {
          const y = 54 + i * 38;
          const hot = mark !== null;
          return (
            <g key={label}>
              {hot && <rect x="14" y={y - 4} width="572" height="32" rx="8" fill="#1e4a7a" />}
              <text x="30" y={y + 18} fontFamily={MONO} fontSize="16" fill={hot ? '#ffffff' : '#a9c4e2'}>
                {label}
              </text>
              <text x="440" y={y + 18} fontFamily={MONO} fontSize="16" fontWeight="700" fill={mark === 'on' ? '#7be0b0' : mark === 'off' ? '#ffb95e' : '#a9c4e2'}>
                [{value}]
              </text>
            </g>
          );
        })}
        <g fontFamily={FONT} fontSize="13" fontWeight="800">
          <rect x="16" y="258" width="268" height="28" rx="14" fill="#ffb95e" />
          <text x="150" y="277" textAnchor="middle" fill="#1d1008">
            Power saving that cuts the NIC: Disabled
          </text>
          <rect x="324" y="258" width="260" height="28" rx="14" fill="#7be0b0" />
          <text x="454" y="277" textAnchor="middle" fill="#0b2a1a">
            Wake switch: Enabled
          </text>
        </g>
      </svg>
    </Figure>
  );
}

/* ---------- Step 3: Windows adapter dialog mock ---------- */

export function WindowsAdapterScreen() {
  const rows: Array<[string, string, boolean]> = [
    ['Energy-Efficient Ethernet', 'Disabled', true],
    ['Flow Control', 'Rx & Tx Enabled', false],
    ['Green Ethernet', 'Disabled', true],
    ['Speed & Duplex', 'Auto Negotiation', false],
    ['Wake on Magic Packet', 'Enabled', true],
    ['Wake on pattern match', 'Disabled', false],
  ];
  return (
    <Figure
      label="A schematic adapter properties dialog on the Advanced tab. Wake on Magic Packet is Enabled; Energy-Efficient Ethernet and Green Ethernet are Disabled."
      caption="Schematic example of Device Manager → your Ethernet adapter → Properties → Advanced. Property names vary by driver."
    >
      <svg viewBox="0 0 600 330" focusable="false">
        <rect x="2" y="2" width="596" height="326" rx="12" fill="#f4f5f8" stroke="#aeb4c4" strokeWidth="2.5" />
        <rect x="2" y="2" width="596" height="34" rx="11" fill="#e4e7ef" />
        <text x="16" y="25" fontFamily={FONT} fontSize="14" fontWeight="700" fill="#2a3040">
          Ethernet adapter Properties
        </text>
        <g fontFamily={FONT} fontSize="13.5" fontWeight="700">
          {['General', 'Advanced', 'Driver', 'Power Management'].map((t, i) => {
            const x = 16 + [0, 82, 170, 240][i]!;
            const w = [76, 82, 64, 150][i]!;
            const active = t === 'Advanced';
            return (
              <g key={t}>
                <rect x={x} y="48" width={w} height="28" rx="7" fill={active ? '#ffffff' : '#e9ecf3'} stroke="#aeb4c4" />
                <text x={x + w / 2} y="67" textAnchor="middle" fill="#2a3040">
                  {t}
                </text>
              </g>
            );
          })}
        </g>
        <rect x="16" y="76" width="568" height="238" rx="8" fill="#ffffff" stroke="#aeb4c4" />
        <text x="32" y="102" fontFamily={FONT} fontSize="12" fontWeight="800" fill="#566078" letterSpacing="0.6">
          PROPERTY
        </text>
        <text x="372" y="102" fontFamily={FONT} fontSize="12" fontWeight="800" fill="#566078" letterSpacing="0.6">
          VALUE
        </text>
        {rows.map(([name, value, mark], i) => {
          const y = 112 + i * 32;
          const wake = name === 'Wake on Magic Packet';
          return (
            <g key={name}>
              {mark && <rect x="24" y={y - 4} width="552" height="28" rx="6" fill={wake ? '#d7f3e3' : '#fdf0cf'} />}
              <text x="32" y={y + 15} fontFamily={FONT} fontSize="14" fill="#1f2535" fontWeight={mark ? 700 : 500}>
                {name}
              </text>
              <text x="372" y={y + 15} fontFamily={FONT} fontSize="14" fill="#1f2535" fontWeight={mark ? 800 : 500}>
                {value}
              </text>
            </g>
          );
        })}
      </svg>
    </Figure>
  );
}

export function WindowsPowerTab() {
  return (
    <Figure
      label="A schematic Power Management tab with 'Allow this device to wake the computer' ticked and 'Only allow a magic packet to wake the computer' ticked."
      caption="Same dialog, Power Management tab. Keep both wake options ticked."
    >
      <svg viewBox="0 0 600 190" focusable="false">
        <rect x="2" y="2" width="596" height="186" rx="12" fill="#f4f5f8" stroke="#aeb4c4" strokeWidth="2.5" />
        {[
          ['Allow the computer to turn off this device to save power', false, 'Untick while troubleshooting'],
          ['Allow this device to wake the computer', true, 'Tick'],
          ['Only allow a magic packet to wake the computer', true, 'Tick'],
        ].map(([label, on, note], i) => {
          const y = 28 + i * 54;
          return (
            <g key={String(label)}>
              <rect x="22" y={y} width="22" height="22" rx="5" fill="#ffffff" stroke="#566078" strokeWidth="2" />
              {on && <path d={`M27 ${y + 11}l5 5 9-10`} fill="none" stroke="#17794a" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />}
              <text x="56" y={y + 17} fontFamily={FONT} fontSize="14.5" fill="#1f2535" fontWeight="600">
                {String(label)}
              </text>
              <text x="56" y={y + 36} fontFamily={FONT} fontSize="12" fill={on ? '#17794a' : '#8a5a00'} fontWeight="800">
                {String(note)}
              </text>
            </g>
          );
        })}
      </svg>
    </Figure>
  );
}

/* ---------- Step 4: Windows shutdown settings mock ---------- */

export function WindowsPowerScreen() {
  const rows: Array<[string, boolean, boolean]> = [
    ['Turn on fast startup (recommended)', false, true],
    ['Sleep', true, false],
    ['Hibernate', false, false],
    ['Lock', true, false],
  ];
  return (
    <Figure
      label="A schematic 'Shutdown settings' list. 'Turn on fast startup' is unticked and highlighted."
      caption="Control Panel → Power Options → Choose what the power buttons do → Change settings that are currently unavailable."
    >
      <svg viewBox="0 0 600 230" focusable="false">
        <rect x="2" y="2" width="596" height="226" rx="12" fill="#f4f5f8" stroke="#aeb4c4" strokeWidth="2.5" />
        <text x="22" y="34" fontFamily={FONT} fontSize="15" fontWeight="800" fill="#2a3040">
          Shutdown settings
        </text>
        {rows.map(([label, on, hot], i) => {
          const y = 52 + i * 42;
          return (
            <g key={label}>
              {hot && <rect x="14" y={y - 6} width="572" height="38" rx="8" fill="#ffe4cf" stroke="#ff7a3d" strokeWidth="2" />}
              <rect x="26" y={y + 2} width="22" height="22" rx="5" fill="#ffffff" stroke="#566078" strokeWidth="2" />
              {on && <path d={`M31 ${y + 13}l5 5 9-10`} fill="none" stroke="#2a3040" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />}
              <text x="62" y={y + 19} fontFamily={FONT} fontSize="15" fill="#1f2535" fontWeight={hot ? 800 : 500}>
                {label}
              </text>
              {hot && (
                <g fontFamily={FONT} fontSize="12.5" fontWeight="800">
                  <rect x="440" y={y + 1} width="132" height="24" rx="12" fill="#ff7a3d" />
                  <text x="506" y={y + 17.5} textAnchor="middle" fill="#1d1008">
                    Leave this OFF
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </Figure>
  );
}

/* ---------- Step 5: terminal output + router table ---------- */

export function Terminal({ title, lines, caption }: { title: string; lines: Array<{ text: string; hot?: boolean }>; caption?: string }) {
  const height = 52 + lines.length * 24;
  return (
    <Figure label={`${title}: example terminal output with the MAC address and IP address highlighted.`} caption={caption}>
      <svg viewBox={`0 0 600 ${height}`} focusable="false">
        <rect x="2" y="2" width="596" height={height - 4} rx="12" fill="#0f1426" stroke="#2c3560" strokeWidth="2.5" />
        <rect x="2" y="2" width="596" height="30" rx="11" fill="#1a2140" />
        <circle cx="20" cy="17" r="5" fill="#ff7b6e" />
        <circle cx="38" cy="17" r="5" fill="#f7b030" />
        <circle cx="56" cy="17" r="5" fill="#7ccb45" />
        <text x="300" y="21" textAnchor="middle" fontFamily={FONT} fontSize="12.5" fontWeight="700" fill="#8f98c0">
          {title}
        </text>
        {lines.map((line, i) => (
          <g key={i}>
            {line.hot && <rect x="12" y={42 + i * 24} width="576" height="23" rx="5" fill="#ffb95e" opacity="0.22" />}
            <text x="22" y={59 + i * 24} fontFamily={MONO} fontSize="13.5" fill={line.hot ? '#ffd9a0' : '#c9d0f0'} fontWeight={line.hot ? 700 : 400} xmlSpace="preserve">
              {line.text}
            </text>
          </g>
        ))}
      </svg>
    </Figure>
  );
}

export function RouterScreen() {
  const rows: Array<[string, string, string, boolean]> = [
    ['gaming-pc', 'AA:BB:CC:DD:EE:FF', '192.168.1.50', true],
    ['phone-anna', '12:34:56:78:9A:BC', '192.168.1.71', false],
    ['smart-tv', 'DE:AD:BE:EF:00:11', '192.168.1.80', false],
  ];
  return (
    <Figure
      label="A schematic router web page titled DHCP address reservation, with a table listing a device name, MAC address and reserved IP address. The gaming PC row is highlighted."
      caption="Schematic example. On your router this may be called address reservation, static lease, or IP–MAC binding."
    >
      <svg viewBox="0 0 600 260" focusable="false">
        <rect x="2" y="2" width="596" height="256" rx="12" fill="#f4f5f8" stroke="#aeb4c4" strokeWidth="2.5" />
        <rect x="2" y="2" width="596" height="34" rx="11" fill="#e4e7ef" />
        <rect x="66" y="9" width="404" height="20" rx="10" fill="#ffffff" stroke="#c6cbd8" />
        <text x="82" y="24" fontFamily={MONO} fontSize="12.5" fill="#566078">
          192.168.1.1/lan/dhcp
        </text>
        <text x="22" y="64" fontFamily={FONT} fontSize="16" fontWeight="800" fill="#1f2535">
          DHCP › Address reservation
        </text>
        <g fontFamily={FONT} fontSize="11.5" fontWeight="800" fill="#566078" letterSpacing="0.6">
          <text x="24" y="94">DEVICE</text>
          <text x="170" y="94">MAC ADDRESS</text>
          <text x="372" y="94">RESERVED IP</text>
          <text x="500" y="94">ENABLED</text>
        </g>
        {rows.map(([name, mac, ip, hot], i) => {
          const y = 104 + i * 40;
          return (
            <g key={mac}>
              <rect x="14" y={y} width="572" height="34" rx="7" fill={hot ? '#d7f3e3' : '#ffffff'} stroke={hot ? '#17794a' : '#d6dae5'} strokeWidth={hot ? 2 : 1} />
              <text x="24" y={y + 22} fontFamily={FONT} fontSize="14" fontWeight={hot ? 800 : 500} fill="#1f2535">{name}</text>
              <text x="170" y={y + 22} fontFamily={MONO} fontSize="13.5" fill="#1f2535">{mac}</text>
              <text x="372" y={y + 22} fontFamily={MONO} fontSize="13.5" fontWeight={hot ? 800 : 400} fill="#1f2535">{ip}</text>
              <rect x="508" y={y + 8} width="36" height="18" rx="9" fill={hot ? '#17794a' : '#aeb4c4'} />
              <circle cx={hot ? 535 : 517} cy={y + 17} r="7" fill="#fff" />
            </g>
          );
        })}
        <g fontFamily={FONT} fontSize="13" fontWeight="800">
          <rect x="22" y="228" width="92" height="24" rx="12" fill="#ff7a3d" />
          <text x="68" y="244.5" textAnchor="middle" fill="#1d1008">
            Save
          </text>
        </g>
      </svg>
    </Figure>
  );
}

/* ---------- Step 7: remote access diagrams ---------- */

export function VpnPath() {
  return (
    <Figure
      label="A phone connects through an encrypted VPN tunnel to the ConnectWOL server at home. The server then sends the magic packet over the local network to a sleeping computer."
      caption="The packet is always sent from inside your home network, so no UDP port has to be opened to the internet."
    >
      <svg viewBox="0 0 640 220" focusable="false">
        {/* phone */}
        <rect x="18" y="52" width="62" height="112" rx="14" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3.5" />
        <rect x="27" y="66" width="44" height="76" rx="5" fill="var(--accent-soft)" />
        <circle cx="49" cy="105" r="13" fill="none" stroke="var(--accent-text)" strokeWidth="3.5" />
        <path d="M49 94v11" stroke="var(--accent-text)" strokeWidth="3.5" strokeLinecap="round" />
        <text x="49" y="190" textAnchor="middle" fontFamily={FONT} fontSize="13" fontWeight="700" fill="var(--muted)">
          your phone
        </text>

        {/* tunnel */}
        <path d="M92 108h156" stroke="var(--info)" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 11" />
        <rect x="140" y="82" width="62" height="52" rx="12" fill="var(--surface)" stroke="var(--info)" strokeWidth="3.5" />
        <rect x="156" y="106" width="30" height="20" rx="4" fill="var(--info)" />
        <path d="M161 106v-6a10 10 0 0 1 20 0v6" fill="none" stroke="var(--info)" strokeWidth="3.5" strokeLinecap="round" />
        <text x="171" y="158" textAnchor="middle" fontFamily={FONT} fontSize="13" fontWeight="700" fill="var(--info)">
          VPN or HTTPS
        </text>

        {/* house */}
        <path d="M262 110l82-66 82 66v70H262z" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3.5" strokeLinejoin="round" />
        <rect x="294" y="116" width="100" height="44" rx="8" fill="var(--surface-2)" stroke="var(--ink)" strokeWidth="3" />
        <path d="M308 138h.01M322 138h.01M336 138h.01" stroke="var(--accent-text)" strokeWidth="6" strokeLinecap="round" />
        <path d="M356 138h26" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
        <text x="344" y="102" textAnchor="middle" fontFamily={FONT} fontSize="12.5" fontWeight="800" fill="var(--ink)">
          ConnectWOL
        </text>
        <text x="344" y="196" textAnchor="middle" fontFamily={FONT} fontSize="13" fontWeight="700" fill="var(--muted)">
          Pi / NAS / home server
        </text>

        {/* packet */}
        <path d="M434 138h86" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray="12 9" />
        <path d="M514 128l12 10-12 10" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="478" y="116" textAnchor="middle" fontFamily={FONT} fontSize="12" fontWeight="800" fill="var(--accent-text)">
          magic packet
        </text>

        {/* sleeping pc */}
        <rect x="536" y="96" width="82" height="56" rx="9" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3.5" />
        <path d="M556 124q6 6 12 0M580 124q6 6 12 0" fill="none" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M560 168h34M577 152v16" stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" />
        <g fill="none" stroke="var(--accent-text)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M600 78h10l-10 11h10" />
          <path d="M616 58h7l-7 8h7" />
        </g>
        <text x="577" y="196" textAnchor="middle" fontFamily={FONT} fontSize="13" fontWeight="700" fill="var(--muted)">
          sleeping PC
        </text>
      </svg>
    </Figure>
  );
}

export function ArpDiagram() {
  const lane = (x: number, title: string, good: boolean, steps: string[]) => (
    <g transform={`translate(${x} 0)`}>
      <rect x="0" y="0" width="290" height="300" rx="20" fill="var(--surface)" stroke={good ? 'var(--ok)' : 'var(--danger)'} strokeWidth="2.5" />
      <text x="18" y="34" fontFamily={FONT} fontSize="15.5" fontWeight="800" fill={good ? 'var(--ok)' : 'var(--danger)'}>
        {title}
      </text>
      {steps.map((text, i) => {
        const y = 56 + i * 48;
        const last = i === steps.length - 1;
        return (
          <g key={i}>
            <circle cx="30" cy={y + 16} r="13" fill={last ? (good ? 'var(--ok)' : 'var(--danger)') : 'var(--surface-2)'} stroke="var(--line-strong)" strokeWidth="1.5" />
            <text x="30" y={y + 21} textAnchor="middle" fontFamily={FONT} fontSize="13" fontWeight="800" fill={last ? '#fff' : 'var(--ink)'}>
              {i + 1}
            </text>
            {text.split('\n').map((l, j) => (
              <text key={j} x="54" y={y + 13 + j * 16} fontFamily={FONT} fontSize="12.5" fill="var(--ink-2)" fontWeight={last ? 800 : 500}>
                {l}
              </text>
            ))}
            {i < steps.length - 1 && <path d={`M30 ${y + 31}v17`} stroke="var(--line-strong)" strokeWidth="2.5" strokeLinecap="round" />}
          </g>
        );
      })}
    </g>
  );
  return (
    <Figure
      label="Two timelines. Without a static ARP entry, the router forgets the sleeping PC's MAC address and drops the wake packet. With an IP to MAC binding, the router still knows the MAC address and delivers the packet, so the PC wakes."
      caption="A sleeping computer cannot answer ARP requests, so a router that has forgotten its MAC address has nowhere to send the packet."
    >
      <svg viewBox="0 0 600 300" focusable="false">
        {lane(2, 'Without a static ARP entry', false, [
          'PC goes to sleep',
          'Router forgets its MAC\n(ARP entry expires)',
          'Wake packet arrives\nfrom the internet',
          'Router asks "who has\n192.168.1.50?" - no answer',
          'Packet dropped.\nPC stays asleep',
        ])}
        {lane(308, 'With IP–MAC binding', true, [
          'PC goes to sleep',
          'Router keeps the fixed\nIP ↔ MAC pairing',
          'Wake packet arrives\nfrom the internet',
          'Router sends it straight\nto the PC\'s MAC',
          'Network card sees the\nmagic packet. PC wakes',
        ])}
      </svg>
    </Figure>
  );
}

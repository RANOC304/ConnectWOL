import Link from 'next/link';
import { Accordion, Callout, Checklist, CodeBlock, Tabs } from './GuideUi';
import { ArpDiagram, RouterScreen, Terminal, VpnPath } from './Illustrations';
import { TestWake } from './TestWake';

/* ============================== Step 5 ============================== */

export function Step5() {
  return (
    <div className="step-body">
      <section>
        <h2>The two numbers you need</h2>
        <p>
          ConnectWOL needs the <strong>MAC address</strong> (the card’s permanent hardware address, which goes inside the packet) and, ideally, the computer’s <strong>IP address</strong> on your network (used to choose the right network and to check
          whether it is online).
        </p>
        <Callout kind="warn" title="Use the wired adapter’s MAC">
          Computers often have several: Ethernet, Wi-Fi, Bluetooth, VPN, virtual machines. Wake-on-LAN needs the one on the <strong>Ethernet</strong> card that is plugged into your router.
        </Callout>
      </section>

      <Tabs
        label="Operating system of the computer to wake"
        tabs={[
          {
            id: 'win',
            label: 'Windows',
            content: (
              <>
                <p>
                  Open <strong>Command Prompt</strong> and run <code>ipconfig /all</code>. Under <em>Ethernet adapter Ethernet</em>, read <strong>Physical Address</strong> (the MAC) and <strong>IPv4 Address</strong>.
                </p>
                <CodeBlock label="Command Prompt" code={'ipconfig /all\n\n# or just the MAC addresses of all adapters:\ngetmac /v /fo list'} />
                <Terminal
                  title="Command Prompt: ipconfig /all"
                  caption="Example output, trimmed. Your values will differ."
                  lines={[
                    { text: 'Ethernet adapter Ethernet:' },
                    { text: '' },
                    { text: '   Description . . . . . . : Realtek PCIe GbE Family Controller' },
                    { text: '   Physical Address. . . . : AA-BB-CC-DD-EE-FF', hot: true },
                    { text: '   DHCP Enabled. . . . . . : Yes' },
                    { text: '   IPv4 Address. . . . . . : 192.168.1.50(Preferred)', hot: true },
                    { text: '   Default Gateway . . . . : 192.168.1.1' },
                  ]}
                />
                <p>
                  Or: <strong>Settings → Network &amp; internet → Ethernet → Hardware properties</strong> shows both.
                </p>
              </>
            ),
          },
          {
            id: 'mac',
            label: 'macOS',
            content: (
              <>
                <p>
                  <strong>System Settings → Network → Ethernet → Details… → Hardware</strong> shows the MAC address; <strong>TCP/IP</strong> shows the IP. In Terminal:
                </p>
                <CodeBlock label="Terminal" code={'ifconfig en0 | grep ether\nipconfig getifaddr en0\n\n# list every interface and its hardware port\nnetworksetup -listallhardwareports'} />
                <p>
                  Ethernet is often <code>en0</code> on desktops and <code>en5</code> or higher through a USB/Thunderbolt adapter. <code>networksetup</code> tells you which is which. Since a Mac wakes from sleep over Wi-Fi too, use the MAC of whichever
                  interface it will be on while asleep.
                </p>
              </>
            ),
          },
          {
            id: 'linux',
            label: 'Linux',
            content: (
              <>
                <CodeBlock label="Terminal" code={'ip -br link        # name, state and MAC of every interface\nip -br addr        # name and IP addresses\ncat /sys/class/net/enp3s0/address'} />
                <Terminal
                  title="Terminal: ip -br link"
                  caption="Example output. The MAC is the third column."
                  lines={[
                    { text: 'lo               UNKNOWN        00:00:00:00:00:00 <LOOPBACK,UP,LOWER_UP>' },
                    { text: 'enp3s0           UP             aa:bb:cc:dd:ee:ff <BROADCAST,MULTICAST,UP,LOWER_UP>', hot: true },
                    { text: 'wlp2s0           DOWN           12:34:56:78:9a:bc <BROADCAST,MULTICAST>' },
                  ]}
                />
              </>
            ),
          },
        ]}
      />

      <section>
        <h2>Pin the IP address on your router</h2>
        <p>
          Home routers hand out addresses automatically (DHCP), and a computer’s address can change. A <strong>DHCP reservation</strong> (also “static lease” or “address reservation”) tells the router to always give this MAC the same IP. That keeps the status check
          working and is essential for port forwarding in step 7.
        </p>
        <ol>
          <li>
            Open your router’s page in a browser. The address is often <code>192.168.1.1</code>, <code>192.168.0.1</code> or <code>10.0.0.1</code> (it is the “Default Gateway” in the output above).
          </li>
          <li>
            Find <strong>DHCP</strong>, <strong>LAN</strong> or <strong>Address Reservation</strong>.
          </li>
          <li>Pick the computer from the list (or type its MAC), choose the IP it should always have, and save.</li>
          <li>Restart the computer’s network connection, or reboot it, so it picks up the reserved address.</li>
        </ol>
        <RouterScreen />
      </section>

      <section>
        <h2>Add it to ConnectWOL</h2>
        <p>You have what you need. Any MAC format is accepted: <code>AA:BB:CC:DD:EE:FF</code>, <code>AA-BB-CC-DD-EE-FF</code>, <code>AABB.CCDD.EEFF</code> or plain hex.</p>
        <p>
          <Link className="btn" href="/?add=1">
            Add the computer now
          </Link>
        </p>
      </section>
    </div>
  );
}

/* ============================== Step 6 ============================== */

export function Step6() {
  return (
    <div className="step-body">
      <section>
        <h2>Send a real packet</h2>
        <p>Do the test in this order. Each stage proves something different.</p>
        <ol>
          <li>
            <strong>Put the computer to sleep</strong> (not off yet) and wait about 30 seconds so it is fully asleep. Check that its fans and lights have stopped.
          </li>
          <li>Choose it below and press <strong>Send test wake</strong>. Watch the computer for up to a minute.</li>
          <li>
            If that works, repeat from <strong>hibernate</strong> and then from a full <strong>shut down</strong>. These are separate states, and each one can fail on its own.
          </li>
        </ol>
      </section>

      <TestWake />

      <Callout kind="note" title="What “sent” does and does not mean">
        Wake-on-LAN has no reply. ConnectWOL can tell you the packets left this server, and, if you set a status port, whether the computer starts answering afterwards. It can never prove that a packet reached the network card.
      </Callout>

      <section>
        <h2>It didn’t wake?</h2>
        <p>Work through these in order. Most failures are one of the first three.</p>
        <Checklist
          id="s6"
          items={[
            'Step 2: the wake setting is enabled in the BIOS/UEFI, and ErP / Deep Sleep is disabled.',
            'Step 3: the adapter allows waking on a magic packet (and, on Windows, “Shutdown Wake-On-Lan” if present).',
            'Step 4: Fast Startup is off.',
            'The Ethernet link lights stay on while the computer is asleep or off.',
            'The MAC in ConnectWOL is the wired adapter’s, not Wi-Fi or a virtual adapter.',
            'ConnectWOL and the computer are on the same subnet (usually the same router and not a guest network).',
          ]}
        />
        <p>
          Still stuck? The <Link href="/guide/troubleshooting">troubleshooting guide</Link> goes deeper, including how to look at the packets on the wire.
        </p>
      </section>

      <section>
        <h2>Optional: see the packet leave the server</h2>
        <p>On the machine that runs ConnectWOL, this prints every wake packet as it is sent (the 6 × <code>ff</code> start and the repeated MAC are easy to spot):</p>
        <CodeBlock label="Terminal on the ConnectWOL server" code={"sudo tcpdump -ni any -X 'udp and (port 7 or port 9)'"} />
      </section>
    </div>
  );
}

/* ============================== Step 7 ============================== */

export function Step7() {
  return (
    <div className="step-body">
      <section>
        <h2>The idea: send the packet from home</h2>
        <p>
          A magic packet is a local-network broadcast, and routers do not let it in from the internet. So the cleanest design is: <strong>reach the ConnectWOL server (which lives on your home network) securely, and let <em>it</em> send the packet locally</strong>. Nothing
          has to be opened to the internet for waking.
        </p>
        <VpnPath />
      </section>

      <section>
        <h2>Option A (recommended): a VPN</h2>
        <p>Put your phone “virtually” on your home network. Any WireGuard-based VPN works, and this is the safest option because the app is never exposed to the internet.</p>
        <Tabs
          label="VPN choice"
          tabs={[
            {
              id: 'tailscale',
              label: 'Tailscale (easiest)',
              content: (
                <>
                  <ol>
                    <li>Install Tailscale on the ConnectWOL server and on your phone, and sign in with the same account.</li>
                    <li>
                      Open <code>http://&lt;server-name&gt;:3000</code> on the phone (the name is shown in the Tailscale app), or ask Tailscale for HTTPS so the app can be installed to the home screen:
                    </li>
                  </ol>
                  <CodeBlock label="Terminal on the ConnectWOL server" code={'curl -fsSL https://tailscale.com/install.sh | sh\nsudo tailscale up\nsudo tailscale serve --bg 3000   # HTTPS on your tailnet name'} />
                  <Callout kind="note">
                    Tailscale uses its own coordination service to introduce your devices to each other (your traffic is still end-to-end encrypted). If you want nothing third-party at all, use plain WireGuard. With <code>tailscale serve</code>, set{' '}
                    <code>TRUST_PROXY=true</code> for the ConnectWOL server so cookies are marked Secure.
                  </Callout>
                </>
              ),
            },
            {
              id: 'wireguard',
              label: 'WireGuard (self-hosted)',
              content: (
                <>
                  <p>
                    Run a WireGuard server on your router or on the ConnectWOL host (tools like PiVPN or wg-easy make this a guided install), add your phone as a client, and open <code>http://&lt;server-LAN-IP&gt;:3000</code> while connected. You forward one
                    UDP port for WireGuard itself, and everything else stays closed.
                  </p>
                  <CodeBlock label="Terminal on a Raspberry Pi" code={'curl -L https://install.pivpn.io | bash\npivpn add          # create a profile, scan its QR code with the WireGuard app'} />
                </>
              ),
            },
          ]}
        />
      </section>

      <section>
        <h2>Option B: HTTPS through a reverse proxy</h2>
        <p>
          If you want to open ConnectWOL from any browser without a VPN, put it behind a reverse proxy with a real certificate. The app has its own login, CSRF protection and rate limiting, but it is still a public door to a control panel, so choose a long password
          and consider adding an allow-list or an extra layer such as a VPN-only hostname.
        </p>
        <CodeBlock
          label="Caddyfile"
          code={'wol.example.com {\n\treverse_proxy 127.0.0.1:3000\n}\n# Caddy fetches and renews the HTTPS certificate automatically.'}
        />
        <Callout kind="warn" title="Tell ConnectWOL it is behind a proxy">
          Set <code>TRUST_PROXY=true</code> only when a proxy you control sits in front. It makes the app trust <code>X-Forwarded-For</code>, <code>X-Forwarded-Proto</code> and <code>X-Forwarded-Host</code> (rate limiting per client, Secure cookies, origin
          checks). Never set it when the app is reachable directly.
        </Callout>
      </section>

      <section>
        <h2>Advanced: waking without a VPN</h2>
        <p>
          You can also send a packet to your home network’s public address, for example from ConnectWOL running somewhere else. This works, but it opens a UDP port to the internet and has a gotcha with sleeping computers. Read all of it before you try.
        </p>
        <Accordion
          items={[
            {
              id: 'forward',
              title: 'Port forwarding',
              body: (
                <>
                  <p>
                    In your router’s <strong>Port Forwarding</strong> (or Virtual Server) page, forward an external UDP port to the sleeping computer’s <strong>reserved</strong> IP (step 5) on port 9. Choose an uncommon external port, for example 40009, rather
                    than 9 itself.
                  </p>
                  <p>
                    Many routers cannot forward to a broadcast address (<code>192.168.1.255</code>), and the ones that can often disable it for security. Forwarding to the computer’s own IP is the usual route, which is exactly why the next section matters.
                  </p>
                  <p>
                    If your provider uses carrier-grade NAT (your router’s “WAN” address differs from what “what is my IP” sites show), you cannot forward ports at all. Use Option A.
                  </p>
                </>
              ),
            },
            {
              id: 'arp',
              title: 'Why a sleeping computer breaks forwarded packets (static ARP / IP–MAC binding)',
              body: (
                <>
                  <p>
                    Your router delivers a packet to a device by its MAC address, which it learns through <strong>ARP</strong>: it asks “who has 192.168.1.50?” and the device answers. That answer is remembered for only a few minutes. A sleeping computer does not
                    answer ARP, so a while after it goes to sleep the router forgets its MAC. A wake packet arriving later has nowhere to go and is dropped.
                  </p>
                  <ArpDiagram />
                  <p>
                    The fix is a <strong>static ARP entry</strong>, which routers often call <strong>IP &amp; MAC Binding</strong> or <strong>ARP binding</strong>. It permanently ties the reserved IP to the computer’s MAC, so the router can always deliver the frame, and the
                    network card then sees the magic packet. Look for it under LAN, Security or Advanced settings; it is separate from the DHCP reservation.
                  </p>
                  <Callout kind="tip">
                    No such option on your router? Forwarding to the broadcast address, a VPN, or a small always-on device that sends the packet locally (that is ConnectWOL itself) avoid the problem.
                  </Callout>
                </>
              ),
            },
            {
              id: 'ddns',
              title: 'Dynamic DNS (a stable name for a changing address)',
              body: (
                <>
                  <p>
                    Home IP addresses change. A <strong>DDNS</strong> service gives you a name such as <code>myhome.example.net</code> that always points at your current address, updated by your router or a small client. Most routers have DDNS built in.
                  </p>
                  <p>
                    In ConnectWOL, edit the computer, open <strong>Advanced options → How to reach it → Another network</strong>, enter the DDNS name as the address and the <em>external</em> forwarded port (for example 40009). The server resolves the name each time
                    and sends the packet straight to it.
                  </p>
                </>
              ),
            },
            {
              id: 'risk',
              title: 'What you expose',
              body: (
                <p>
                  Anyone who learns your address, the forwarded port and a computer’s MAC address could send it a magic packet. The worst outcome is that your computer wakes up, but it is still a reason to prefer a VPN. An uncommon port, and a SecureOn password if your
                  network card supports one, raise the bar. They are not strong security.
                </p>
              ),
            },
          ]}
        />
      </section>

      <Callout kind="tip" title="You’re done">
        Install ConnectWOL on your phone’s home screen from <Link href="/settings">Settings</Link>, add each computer once, and wake them from anywhere your VPN reaches.
      </Callout>
    </div>
  );
}

/* ============================== Troubleshooting ============================== */

export function Troubleshooting() {
  return (
    <div className="step-body">
      <section>
        <h2>Start here</h2>
        <p>Change one thing at a time and test after each change (step 6). Waking from <em>sleep</em> is the easiest case, so get that working first, then hibernate, then a full shutdown.</p>
      </section>

      <Accordion
        openFirst
        items={[
          {
            id: 'nothing',
            title: 'Nothing happens at all',
            body: (
              <>
                <ul>
                  <li>
                    <strong>Link lights:</strong> shut the computer down. Are the Ethernet lights still on? If not, the card has no power: check ErP/Deep Sleep (step 2) and the wake setting.
                  </li>
                  <li>
                    <strong>MAC address:</strong> is it really the wired adapter’s? Compare with <code>ipconfig /all</code> or <code>ip -br link</code>.
                  </li>
                  <li>
                    <strong>Adapter:</strong> “Wake on Magic Packet” enabled and “Allow this device to wake the computer” ticked (step 3).
                  </li>
                  <li>
                    <strong>Same network:</strong> the ConnectWOL server and the computer must share a subnet. A guest network, VLAN or “client isolation” breaks it.
                  </li>
                  <li>
                    <strong>Port:</strong> try 9 and 7. Some cards listen on one only.
                  </li>
                </ul>
              </>
            ),
          },
          {
            id: 'sleep-only',
            title: 'It wakes from sleep but not from shutdown',
            body: (
              <ul>
                <li>Windows: turn off Fast Startup (step 4) and enable “Shutdown Wake-On-Lan” or “Wake on Magic Packet from power off state” if your driver has it.</li>
                <li>Firmware: disable ErP / EuP / Deep Sleep and make sure the PCI-E wake option is on.</li>
                <li>Linux: some drivers reset Wake-on-LAN when powering off. Re-arm it from a service that runs before shutdown.</li>
                <li>macOS: a shut-down Mac cannot be woken this way; use sleep.</li>
              </ul>
            ),
          },
          {
            id: 'sometimes',
            title: 'It worked once, then stopped (or only works sometimes)',
            body: (
              <ul>
                <li>Windows updates and driver updates can reset adapter properties. Re-check step 3.</li>
                <li>
                  Remote wake through port forwarding fails after the router forgets the sleeping computer’s MAC (see the ARP section in step 7). Add an IP–MAC binding.
                </li>
                <li>A DHCP lease changed the computer’s IP. Create a reservation (step 5).</li>
                <li>Laptops often only wake on mains power. Plug it in.</li>
              </ul>
            ),
          },
          {
            id: 'unwanted',
            title: 'The computer wakes by itself right after sleeping',
            body: (
              <ul>
                <li>Windows: on the adapter’s Power Management tab tick “Only allow a magic packet to wake the computer” and set “Wake on pattern match” to Disabled.</li>
                <li>
                  See what woke it: <code>powercfg /lastwake</code> and <code>powercfg /devicequery wake_armed</code>. Un-arm devices you do not want (mouse, keyboard) in Device Manager.
                </li>
              </ul>
            ),
          },
          {
            id: 'wifi',
            title: 'The computer is on Wi-Fi',
            body: (
              <p>
                Most Wi-Fi adapters cannot be woken from a full shutdown, and many only from sleep when both the adapter and the access point support Wake on Wireless LAN. If you can, connect the computer by Ethernet; even a cheap USB Ethernet adapter that supports
                Wake-on-LAN helps. A Mac can wake from sleep over Wi-Fi with “Wake for network access”.
              </p>
            ),
          },
          {
            id: 'status',
            title: 'ConnectWOL says “sent”, but the status never shows Online',
            body: (
              <ul>
                <li>The status check connects to a TCP port; the port must be open <em>while the computer runs</em> (3389 needs Remote Desktop enabled, 22 needs an SSH server).</li>
                <li>Windows Firewall blocks inbound connections on the Public profile by default. Allow the service, or choose a port that is open.</li>
                <li>Give a slow machine a minute or two to finish booting. The status check is best-effort and a firewall that drops packets looks the same as a machine that is off.</li>
              </ul>
            ),
          },
          {
            id: 'docker',
            title: 'ConnectWOL runs in Docker',
            body: (
              <ul>
                <li>
                  On Linux, run the container with <code>network_mode: host</code> (the provided compose file does). Otherwise broadcasts stay inside Docker’s own network.
                </li>
                <li>Docker Desktop on Windows or macOS runs containers in a VM, and host networking does not reach your LAN. Run ConnectWOL directly with Node.js there, or on a Linux host.</li>
              </ul>
            ),
          },
          {
            id: 'subnets',
            title: 'Computers on a different subnet or VLAN',
            body: (
              <ul>
                <li>Broadcasts do not cross routers. Put the ConnectWOL server on the same subnet as the computers, or give it an interface in each VLAN.</li>
                <li>
                  If the server is attached to the computer’s subnet but chooses the wrong interface, set the <strong>Broadcast address</strong> in the computer’s advanced options (for example <code>192.168.20.255</code>).
                </li>
                <li>Routers rarely forward “directed broadcasts” between subnets; assume they do not.</li>
              </ul>
            ),
          },
          {
            id: 'wire',
            title: 'Check that the packet really leaves the server',
            body: (
              <>
                <p>On the ConnectWOL host, watch UDP ports 7 and 9 while you press the wake button. You should see packets of 102 bytes (more with SecureOn) starting with six <code>ff</code> bytes:</p>
                <CodeBlock label="Terminal on the ConnectWOL server" code={"sudo tcpdump -ni any -X 'udp and (port 7 or port 9)'"} />
                <p>
                  Nothing there? Check the History page: a “Failed” entry names the reason (unreachable network, host name that does not resolve…). Packets visible but no wake? The problem is on the computer’s side (steps 2–4) or between the two.
                </p>
              </>
            ),
          },
          {
            id: 'isolate',
            title: 'Rule out ConnectWOL with another tool',
            body: (
              <>
                <p>Send a packet with a different tool from the same host. If that wakes the computer and ConnectWOL does not, compare the MAC, port and network. If neither works, the cause is in the computer or the network.</p>
                <CodeBlock label="Terminal" code={'# Linux / Raspberry Pi\nsudo apt install wakeonlan\nwakeonlan aa:bb:cc:dd:ee:ff\n\n# or\nsudo apt install etherwake\nsudo etherwake -i eth0 aa:bb:cc:dd:ee:ff'} />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

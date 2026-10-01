import { Accordion, Callout, Checklist, CodeBlock, Tabs } from './GuideUi';
import { BiosScreen, WindowsAdapterScreen, WindowsPowerScreen, WindowsPowerTab, WiredVsWifi } from './Illustrations';

/* ============================== Step 1 ============================== */

export function Step1() {
  return (
    <div className="step-body">
      <section>
        <h2>How a sleeping computer hears you</h2>
        <p>
          A <strong>magic packet</strong> is a tiny network message that contains the target’s MAC address sixteen times in a row. While the computer sleeps or is switched off, its network card keeps a trickle of power and does
          one job: watch the wire for a packet that contains its own address. When it sees one, it tells the motherboard to power the machine on.
        </p>
        <p>
          That only works if the card is <em>powered</em> and <em>told to listen</em>. Steps 2 to 4 make sure of both. This step is about whether your hardware can do it at all.
        </p>
      </section>

      <section>
        <WiredVsWifi />
      </section>

      <section>
        <h2>What usually works</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Connection</th>
                <th>From sleep</th>
                <th>From hibernate / shut down</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Wired Ethernet</td>
                <td>Yes, on most hardware</td>
                <td>Yes, once the firmware allows it (step 2)</td>
              </tr>
              <tr>
                <td>Wi-Fi (Wake on Wireless LAN)</td>
                <td>Only on some adapters, access points and operating systems</td>
                <td>Almost never</td>
              </tr>
              <tr>
                <td>Mac (any connection)</td>
                <td>Yes, with “Wake for network access”</td>
                <td>No: a Mac that is shut down cannot be woken this way</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Treat this table as a rule of thumb, not a promise. Laptops, small-form-factor PCs and machines with “modern standby” often behave differently from classic desktops. Only a test on <em>your</em> machine (step 6) settles it.
        </p>
      </section>

      <Callout kind="tip" title="The computer that runs ConnectWOL">
        It only needs to be on the same network as your computers and always on. A Raspberry Pi, NAS or mini PC on Ethernet is ideal. Wi-Fi is fine for <em>sending</em> packets, but some access points filter broadcast traffic.
      </Callout>

      <section>
        <h2>Quick check</h2>
        <Checklist
          id="s1"
          items={[
            'The computer I want to wake has an Ethernet port and I can connect a cable to my router or switch.',
            'The cable stays plugged in while the computer sleeps or is off (some people unplug it to “save power”).',
            'The computer stays connected to mains power. A laptop’s battery alone is often not enough, and many laptops disable wake-up on battery.',
            'The ConnectWOL server and the computer are on the same network (same router, not a guest network).',
          ]}
        />
      </section>
    </div>
  );
}

/* ============================== Step 2 ============================== */

const VENDORS: Array<[string, string, string]> = [
  ['ASUS', 'Advanced → APM Configuration', 'Power On By PCI-E → Enabled · ErP Ready → Disabled'],
  ['MSI', 'Settings → Advanced → Wake Up Event Setup', 'Resume By PCI-E Device → Enabled · (Power Management) ErP Ready → Disabled'],
  ['Gigabyte / Aorus', 'Settings → Platform Power (or Power)', 'Wake on LAN → Enabled · ErP → Disabled'],
  ['ASRock', 'Advanced → ACPI Configuration', 'PCIE Devices Power On → Enabled · Deep Sleep → Disabled'],
  ['Dell', 'Power Management (or Power)', 'Wake on LAN/WLAN → LAN Only · Deep Sleep Control → Disabled'],
  ['HP', 'Advanced → Power Management Options', 'S5 Wake on LAN / Wake on LAN → Enabled (names vary by model)'],
  ['Lenovo', 'Config → Network (ThinkPad) · Power (desktops)', 'Wake On LAN → AC Only or AC and Battery · Enabled'],
  ['Acer', 'Power (or Advanced)', 'Wake on LAN → Enabled'],
];

export function Step2() {
  return (
    <div className="step-body">
      <section>
        <h2>Why the firmware matters</h2>
        <p>
          The BIOS/UEFI decides whether the motherboard keeps feeding the network card when the computer is off. Many boards ship with that switched off, and “green” power options (ErP, Deep Sleep) can cut it even when it is on.
        </p>
      </section>

      <section>
        <h2>Open the firmware settings</h2>
        <ol>
          <li>
            Restart and tap the setup key as the logo appears. It is usually <kbd>Del</kbd> or <kbd>F2</kbd>; some use <kbd>F10</kbd>, <kbd>F1</kbd> or <kbd>Esc</kbd>.
          </li>
          <li>
            Or, on Windows 10/11: <strong>Settings → System → Recovery → Advanced startup → Restart now</strong>, then <strong>Troubleshoot → Advanced options → UEFI Firmware Settings</strong>.
          </li>
          <li>If the screen is simplified, look for an <strong>Advanced Mode</strong> option (often <kbd>F7</kbd> or <kbd>F6</kbd>).</li>
        </ol>
      </section>

      <section>
        <h2>What to turn on, and what to turn off</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Setting</th>
                <th>Set to</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Wake on LAN · Power On By PCI-E · Resume By PCI-E Device · Wake-up by onboard LAN</td>
                <td>Enabled</td>
                <td>The actual wake-up switch. Different vendors, same idea.</td>
              </tr>
              <tr>
                <td>ErP Ready / EuP / Deep Sleep / Deep S4/S5</td>
                <td>Disabled</td>
                <td>Meets energy rules by cutting power to almost everything, including the network card.</td>
              </tr>
              <tr>
                <td>Fast Boot / Ultra Fast Boot</td>
                <td>Try Disabled if waking fails</td>
                <td>On some boards it skips initialising the network card.</td>
              </tr>
              <tr>
                <td>Network Stack / PXE boot</td>
                <td>Optional</td>
                <td>On a few boards, enabling it keeps the LAN chip active.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <BiosScreen />
      </section>

      <section>
        <h2>Typical locations by vendor</h2>
        <p>These are common layouts. Names and menus change between models and firmware versions, so treat them as a map, not a guarantee.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Menu path</th>
                <th>Setting</th>
              </tr>
            </thead>
            <tbody>
              {VENDORS.map(([vendor, path, setting]) => (
                <tr key={vendor}>
                  <td>{vendor}</td>
                  <td>{path}</td>
                  <td>{setting}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout kind="tip">Can’t find it? Use the firmware’s search (if it has one), or search the manual for “wake”, “LAN”, “PCI-E” and “ErP”. Then save and exit (usually <kbd>F10</kbd>).</Callout>
      </section>

      <section>
        <h2>A useful sign</h2>
        <p>
          Shut the computer down and look at the Ethernet socket. <strong>If the little link lights are still on or blinking, the card is powered</strong> and the firmware is doing its part. If the lights go out completely, the card has no power while the computer is off: revisit
          ErP/Deep Sleep, or the wake setting above.
        </p>
      </section>
    </div>
  );
}

/* ============================== Step 3 ============================== */

export function Step3() {
  return (
    <div className="step-body">
      <section>
        <h2>Tell the adapter to listen</h2>
        <p>Even with the firmware ready, the operating system can switch the adapter’s wake feature off. Pick the OS of the computer you want to wake.</p>
      </section>

      <Tabs
        label="Operating system of the computer to wake"
        tabs={[
          {
            id: 'win',
            label: 'Windows',
            content: (
              <>
                <ol>
                  <li>
                    Right-click the Start button → <strong>Device Manager</strong> → expand <strong>Network adapters</strong>.
                  </li>
                  <li>Double-click your <strong>wired</strong> adapter (names like “Realtek PCIe GbE Family Controller” or “Intel(R) Ethernet Connection”). Ignore Wi-Fi, Bluetooth and virtual adapters.</li>
                  <li>
                    <strong>Advanced</strong> tab: set <strong>Wake on Magic Packet</strong> to <strong>Enabled</strong>. If you see <strong>Shutdown Wake-On-Lan</strong> (Realtek) or{' '}
                    <strong>Wake on Magic Packet from power off state</strong> (Intel), enable that too: it is what allows waking from a full shutdown.
                  </li>
                  <li>
                    Still on that tab, set <strong>Energy-Efficient Ethernet</strong>, <strong>Green Ethernet</strong> and <strong>Power Saving Mode</strong> to <strong>Disabled</strong>. They can drop the link in low-power states.
                  </li>
                  <li>
                    <strong>Power Management</strong> tab: tick <strong>Allow this device to wake the computer</strong> and <strong>Only allow a magic packet to wake the computer</strong>.
                  </li>
                </ol>
                <WindowsAdapterScreen />
                <WindowsPowerTab />
                <Callout kind="note" title="Check that Windows agrees">
                  In a command prompt, <code>powercfg /devicequery wake_armed</code> lists devices allowed to wake the PC. Your Ethernet adapter should be in the list.
                </Callout>
                <CodeBlock label="Command Prompt" code={'powercfg /devicequery wake_armed\npowercfg /devicequery wake_programmable'} />
              </>
            ),
          },
          {
            id: 'mac',
            label: 'macOS',
            content: (
              <>
                <ol>
                  <li>
                    <strong>Desktop Macs:</strong> System Settings → <strong>Energy</strong> → turn on <strong>Wake for network access</strong>.
                  </li>
                  <li>
                    <strong>MacBooks:</strong> System Settings → <strong>Battery</strong> → <strong>Options…</strong> → <strong>Wake for network access</strong> (choose “Only on power adapter” or “Always”).
                  </li>
                  <li>
                    Older macOS: System Preferences → <strong>Energy Saver</strong> → <strong>Wake for network access</strong>.
                  </li>
                </ol>
                <p>Or from Terminal: check the current value and enable it.</p>
                <CodeBlock label="Terminal" code={'pmset -g | grep womp\nsudo pmset -a womp 1'} />
                <Callout kind="warn" title="Macs wake from sleep only">
                  A Mac that is fully shut down cannot be woken with a magic packet. Put it to sleep instead, and keep it plugged in. Behaviour differs between Intel and Apple-silicon models.
                </Callout>
              </>
            ),
          },
          {
            id: 'linux',
            label: 'Linux',
            content: (
              <>
                <p>
                  First find the interface name (often <code>eth0</code>, <code>enp3s0</code>, <code>eno1</code>), then read its Wake-on-LAN state. <code>Wake-on: d</code> means disabled; <code>g</code> means “magic packet”.
                </p>
                <CodeBlock label="Terminal" code={'ip -br link\nsudo ethtool enp3s0 | grep -i wake\n# Supports Wake-on: pumbg   <- must include g\n# Wake-on: d               <- disabled'} />
                <p>Enable it for this boot:</p>
                <CodeBlock label="Terminal" code={'sudo ethtool -s enp3s0 wol g'} />
                <p>
                  Most drivers forget the setting at reboot, so make it permanent. Pick the method that matches how your network is managed:
                </p>
                <Accordion
                  items={[
                    {
                      id: 'nm',
                      title: 'NetworkManager (most desktop distributions)',
                      body: (
                        <CodeBlock
                          label="Terminal"
                          code={'nmcli connection show\nsudo nmcli connection modify "Wired connection 1" 802-3-ethernet.wake-on-lan magic\nsudo nmcli connection up "Wired connection 1"'}
                        />
                      ),
                    },
                    {
                      id: 'networkd',
                      title: 'systemd-networkd',
                      body: (
                        <>
                          <p>
                            Create <code>/etc/systemd/network/50-wol.link</code> with your adapter’s MAC address, then reboot:
                          </p>
                          <CodeBlock label="/etc/systemd/network/50-wol.link" code={'[Match]\nMACAddress=aa:bb:cc:dd:ee:ff\n\n[Link]\nWakeOnLan=magic'} />
                        </>
                      ),
                    },
                    {
                      id: 'netplan',
                      title: 'Netplan (Ubuntu Server)',
                      body: (
                        <CodeBlock
                          label="/etc/netplan/50-cloud-init.yaml"
                          code={'network:\n  version: 2\n  ethernets:\n    enp3s0:\n      dhcp4: true\n      wakeonlan: true'}
                        />
                      ),
                    },
                    {
                      id: 'unit',
                      title: 'A small systemd service (works everywhere)',
                      body: (
                        <>
                          <p>
                            Save as <code>/etc/systemd/system/wol.service</code>, then run <code>sudo systemctl enable --now wol</code>:
                          </p>
                          <CodeBlock
                            label="/etc/systemd/system/wol.service"
                            code={'[Unit]\nDescription=Enable Wake-on-LAN\nAfter=network.target\n\n[Service]\nType=oneshot\nExecStart=/usr/sbin/ethtool -s enp3s0 wol g\n\n[Install]\nWantedBy=multi-user.target'}
                          />
                        </>
                      ),
                    },
                  ]}
                />
                <Callout kind="note">
                  If waking works from sleep but not from a full shutdown, some drivers reset the setting while powering off. Re-arming it with a service that runs <em>before</em> shutdown, or checking your distribution’s notes for your NIC driver, usually solves it.
                </Callout>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

/* ============================== Step 4 ============================== */

export function Step4() {
  return (
    <div className="step-body">
      <section>
        <h2>Windows: Fast Startup gets in the way</h2>
        <p>
          With <strong>Fast Startup</strong>, “Shut down” does not really shut Windows down: it saves a hibernation file so the next boot is quicker. In that state many network cards are left unarmed, which is why Wake-on-LAN sometimes works from sleep
          but not from “off”. Turning it off is the single most common fix.
        </p>
      </section>

      <section>
        <h2>Turn off Fast Startup</h2>
        <ol>
          <li>
            Open <strong>Control Panel → Hardware and Sound → Power Options</strong> (or press <kbd>Win</kbd> + <kbd>R</kbd>, type <code>powercfg.cpl</code>).
          </li>
          <li>
            Click <strong>Choose what the power buttons do</strong>, then <strong>Change settings that are currently unavailable</strong> (it needs administrator rights).
          </li>
          <li>
            Untick <strong>Turn on fast startup (recommended)</strong> and click <strong>Save changes</strong>.
          </li>
        </ol>
        <WindowsPowerScreen />
        <Callout kind="tip" title="Prefer the command line?">
          <p>
            This turns off hibernation entirely, which also removes Fast Startup. You lose “Hibernate” as a power option.
          </p>
        </Callout>
        <CodeBlock label="Command Prompt (as administrator)" code={'powercfg /h off'} />
      </section>

      <section>
        <h2>Other settings that can block waking</h2>
        <ul>
          <li>
            <strong>Adapter power management</strong>: the tickboxes from step 3 (“Allow this device to wake the computer”, “Only allow a magic packet…”). While testing, you can untick “Allow the computer to turn off this device to save power”.
          </li>
          <li>
            <strong>PCI Express link state</strong>: in <em>Power Options → Change plan settings → Change advanced power settings → PCI Express → Link State Power Management</em>, choose <strong>Off</strong>.
          </li>
          <li>
            <strong>Networking in standby</strong> (modern laptops): in the same advanced list, look for <em>Networking connectivity in Standby</em> and set it to <strong>Enable</strong>.
          </li>
          <li>
            <strong>Sleep type</strong>: run <code>powercfg /a</code>. If it reports only “Standby (S0 Low Power Idle)”, the machine uses modern standby; waking over the network can work but is less predictable.
          </li>
        </ul>
        <CodeBlock label="Command Prompt" code={'powercfg /a\npowercfg /lastwake'} />
        <p>
          <code>powercfg /lastwake</code> tells you what woke the PC last. After a successful remote wake, it should name your Ethernet adapter.
        </p>
      </section>

      <Callout kind="note" title="Not on Windows?">
        macOS and Linux have no Fast Startup. Steps 2 and 3 cover everything for them. You can skip ahead to step 5.
      </Callout>
    </div>
  );
}

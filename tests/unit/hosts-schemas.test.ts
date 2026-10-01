import { describe, expect, it } from 'vitest';
import { isHostname, isHostOrIp, isIpv4, isIpv6 } from '@/lib/hosts';
import { deviceCreateSchema, devicePatchSchema, fieldErrors } from '@/lib/schemas';

describe('host validation', () => {
  it('IPv4', () => {
    for (const ok of ['0.0.0.0', '192.168.1.1', '255.255.255.255', '10.0.0.254']) expect(isIpv4(ok), ok).toBe(true);
    for (const bad of ['', '1.2.3', '1.2.3.4.5', '256.0.0.1', '01.2.3.4', '1.2.3.04', ' 1.2.3.4', '1.2.3.4 ', 'a.b.c.d', '1..2.3']) {
      expect(isIpv4(bad), bad).toBe(false);
    }
  });

  it('IPv6', () => {
    for (const ok of ['::1', 'fe80::1', '2001:db8::7', '2001:0db8:0000:0000:0000:0000:0000:0001', '::ffff:192.168.1.1']) {
      expect(isIpv6(ok), ok).toBe(true);
    }
    for (const bad of ['', ':', ':::', '12345::1', 'gggg::1', 'fe80::1%eth0', '1.2.3.4', 'fe80::1/64', '[::1]']) {
      expect(isIpv6(bad), bad).toBe(false);
    }
  });

  it('hostnames', () => {
    for (const ok of ['pc', 'desktop.lan', 'my-pc.example.com', 'my-pc.example.com.', 'a1', 'xn--nxasmq6b.example', 'pc_01', 'localhost']) {
      expect(isHostname(ok), ok).toBe(true);
    }
    const bad = ['', '.', '-pc', 'pc-', 'a..b', 'my pc', 'pc/lan', 'pc:80', 'http://pc', '1.2.3', '999.1.1.1', 'a'.repeat(64), `${'a.'.repeat(130)}com`, 'пк.lan'];
    for (const b of bad) expect(isHostname(b), b).toBe(false);
  });

  it('isHostOrIp accepts all three kinds', () => {
    expect(isHostOrIp('10.0.0.1')).toBe(true);
    expect(isHostOrIp('::1')).toBe(true);
    expect(isHostOrIp('nas.lan')).toBe(true);
    expect(isHostOrIp('not valid')).toBe(false);
  });
});

describe('device schemas', () => {
  const base = { name: 'PC', mac: 'aa:bb:cc:dd:ee:ff', target: '10.0.0.5' };

  it('does not inject defaults, so PATCH cannot clobber stored values', () => {
    const created = deviceCreateSchema.parse(base);
    expect(created).toEqual({ name: 'PC', mac: 'AA:BB:CC:DD:EE:FF', target: '10.0.0.5' });
    expect(devicePatchSchema.parse({ name: 'x' })).toEqual({ name: 'x' });
    expect(devicePatchSchema.parse({})).toEqual({});
  });

  it('coerces numeric strings from form inputs', () => {
    expect(deviceCreateSchema.parse({ ...base, port: '7', statusPort: '22' })).toMatchObject({ port: 7, statusPort: 22 });
  });

  it('fieldErrors keeps the first message per field', () => {
    const result = deviceCreateSchema.safeParse({ name: '', mac: 'zz', target: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(Object.keys(errors).sort()).toEqual(['mac', 'name', 'target']);
      expect(errors.name).toBe('Name is required.');
      expect(errors.mac).toMatch(/hexadecimal/);
    }
  });
});

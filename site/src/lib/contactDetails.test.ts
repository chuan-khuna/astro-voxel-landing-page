import { describe, expect, it } from 'vitest';
import { contactDetails } from './contactDetails';
import { site } from '../data/site';

const company = {
  email: 'hello@example.com',
  phone: '+1 (555) 014-2',
  address: '12 Harbour Row, Port Meridian',
  socials: [
    { label: 'GitHub', url: 'https://github.com/example' },
    { label: 'Mastodon', url: 'http://social.example/@us' },
  ],
};

describe('contactDetails', () => {
  it('lists email, phone, address and each social, in that order, each with a label', () => {
    expect(contactDetails(company).map((d) => d.label)).toEqual(['Email', 'Phone', 'Address', 'GitHub', 'Mastodon']);
  });

  it('links the email with mailto: and the phone with tel: (digits and a leading + only)', () => {
    const [email, phone] = contactDetails(company);
    expect(email).toEqual({ label: 'Email', text: 'hello@example.com', href: 'mailto:hello@example.com' });
    expect(phone).toEqual({ label: 'Phone', text: '+1 (555) 014-2', href: 'tel:+15550142' });
  });

  it('shows the address as plain text, with no link', () => {
    expect(contactDetails(company)[2]).toEqual({ label: 'Address', text: '12 Harbour Row, Port Meridian' });
  });

  it('links each social to its URL, shown without the scheme', () => {
    expect(contactDetails(company).slice(3)).toEqual([
      { label: 'GitHub', text: 'github.com/example', href: 'https://github.com/example', external: true },
      { label: 'Mastodon', text: 'social.example/@us', href: 'http://social.example/@us', external: true },
    ]);
  });

  it('gives every detail in the site data module a non-empty text', () => {
    const details = contactDetails(site.company);
    expect(details).toHaveLength(3 + site.company.socials.length);
    for (const d of details) expect(d.text.trim(), d.label).not.toBe('');
  });
});

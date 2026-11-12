/**
 * The Contact panel's details (the Mailbox's section), from the company in
 * the site data module: email, phone, address, then each social, in that
 * order. Information only: Contact has no form and submits nothing.
 */

export interface ContactCompany {
  email: string;
  phone: string;
  address: string;
  socials: ReadonlyArray<{ label: string; url: string }>;
}

export interface ContactDetail {
  /** What the detail is, e.g. `Email` or a social's label. */
  label: string;
  /** The detail as shown. */
  text: string;
  /** Where it links to; none for the address. */
  href?: string;
  /** A link off the site (a social profile). */
  external?: true;
}

export function contactDetails(company: ContactCompany): ContactDetail[] {
  return [
    { label: 'Email', text: company.email, href: `mailto:${company.email}` },
    { label: 'Phone', text: company.phone, href: `tel:${company.phone.replace(/(?!^\+)[^\d]/g, '')}` },
    { label: 'Address', text: company.address },
    ...company.socials.map(({ label, url }) => ({
      label,
      text: url.replace(/^https?:\/\//, ''),
      href: url,
      external: true as const,
    })),
  ];
}

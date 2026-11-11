import { describe, expect, it } from 'vitest';
import { clientSchema, partnerSchema, projectSchema, serviceSchema, teamMemberSchema } from './contentSchemas';

const valid = {
  title: 'Tide tables that forecast themselves',
  summary: 'A forecasting pipeline for a harbour authority.',
  client: 'Port Meridian Authority',
  year: 2024,
  tags: ['forecasting', 'pipelines'],
};

describe('projectSchema', () => {
  it('accepts a Project with the required fields, and the optional tree hint and cover', () => {
    expect(projectSchema.parse(valid)).toEqual(valid);
    const full = { ...valid, tree: 'tall', cover: { src: '/covers/tide.png', alt: 'A tide chart' } };
    expect(projectSchema.parse(full)).toEqual(full);
  });

  it('defaults tags to none', () => {
    const { tags: _, ...noTags } = valid;
    expect(projectSchema.parse(noTags).tags).toEqual([]);
  });

  it('rejects a Project with a missing title, a bad year or an unknown tree hint', () => {
    const { title: _, ...noTitle } = valid;
    expect(projectSchema.safeParse(noTitle).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, year: '2024' }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, year: 1899 }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, tree: 'palm-ish' }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, summary: '' }).success).toBe(false);
  });
});

describe('serviceSchema', () => {
  const service = { title: 'Data engineering', summary: 'Pipelines that give the same answer twice.', icon: 'pipeline', order: 1 };

  it('accepts a Service with a title, summary, known icon and order', () => {
    expect(serviceSchema.parse(service)).toEqual(service);
  });

  it('rejects a Service with an unknown icon, a missing summary or an order that is not a whole number from 1', () => {
    expect(serviceSchema.safeParse({ ...service, icon: 'rocket' }).success).toBe(false);
    const { summary: _, ...noSummary } = service;
    expect(serviceSchema.safeParse(noSummary).success).toBe(false);
    expect(serviceSchema.safeParse({ ...service, order: 0 }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...service, order: 1.5 }).success).toBe(false);
  });
});

describe('clientSchema', () => {
  const client = { name: 'Port Meridian Authority', industry: 'Logistics' };

  it('accepts a Client with a name and industry, and an optional logo', () => {
    expect(clientSchema.parse(client)).toEqual(client);
    const withLogo = { ...client, logo: { src: '/logos/port-meridian.svg', alt: 'Port Meridian Authority' } };
    expect(clientSchema.parse(withLogo)).toEqual(withLogo);
  });

  it('rejects a Client with no name, an empty industry or a logo without a source', () => {
    const { name: _, ...noName } = client;
    expect(clientSchema.safeParse(noName).success).toBe(false);
    expect(clientSchema.safeParse({ ...client, industry: '' }).success).toBe(false);
    expect(clientSchema.safeParse({ ...client, logo: { alt: 'x' } }).success).toBe(false);
  });
});

describe('partnerSchema', () => {
  const partner = { name: 'Cumulus Cloudworks', tier: 'strategic' };

  it('accepts a Partner with a name and a known tier, and an optional logo', () => {
    expect(partnerSchema.parse(partner)).toEqual(partner);
    const withLogo = { ...partner, logo: { src: '/logos/cumulus.svg', alt: 'Cumulus Cloudworks' } };
    expect(partnerSchema.parse(withLogo)).toEqual(withLogo);
  });

  it('rejects a Partner with an unknown tier or no name', () => {
    expect(partnerSchema.safeParse({ ...partner, tier: 'platinum-plus' }).success).toBe(false);
    const { name: _, ...noName } = partner;
    expect(partnerSchema.safeParse(noName).success).toBe(false);
  });
});

describe('teamMemberSchema', () => {
  const member = { name: 'Aroha Bennett', role: 'Principal data engineer', order: 1 };

  it('accepts a Team Member with a name, role and order, and an optional avatar', () => {
    expect(teamMemberSchema.parse(member)).toEqual(member);
    const withAvatar = { ...member, avatar: { src: '/team/aroha.png', alt: 'Aroha Bennett' } };
    expect(teamMemberSchema.parse(withAvatar)).toEqual(withAvatar);
  });

  it('rejects a Team Member with no name, an empty role, an order that is not a whole number from 1, or an avatar without a source', () => {
    const { name: _, ...noName } = member;
    expect(teamMemberSchema.safeParse(noName).success).toBe(false);
    expect(teamMemberSchema.safeParse({ ...member, role: '' }).success).toBe(false);
    expect(teamMemberSchema.safeParse({ ...member, order: 0 }).success).toBe(false);
    expect(teamMemberSchema.safeParse({ ...member, order: 2.5 }).success).toBe(false);
    expect(teamMemberSchema.safeParse({ ...member, avatar: { alt: 'x' } }).success).toBe(false);
  });
});

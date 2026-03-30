const { EmbedBuilder } = require('discord.js');

const COLORS = {
  primary: '#D90429',
  success: '#15803D',
  warning: '#EA580C',
  danger: '#B91C1C',
  info: '#0284C7',
  accent: '#CA8A04',
};

const SEPARATOR = '━━━━━━━━━━━━━━━━━━━━';
const BRAND_FOOTER = 'DraXar Competitive • Elite Ops';
const THEMES = {
  default: {
    color: 'primary',
    footer: BRAND_FOOTER,
  },
  leaderboard: {
    color: 'primary',
    footer: 'DraXar Leaderboard Circuit',
  },
  matchmaking: {
    color: 'accent',
    footer: 'DraXar Matchmaking Arena',
  },
  moderation: {
    color: 'danger',
    footer: 'DraXar Moderation Command',
  },
  support: {
    color: 'warning',
    footer: 'DraXar Support Desk',
  },
  system: {
    color: 'info',
    footer: 'DraXar Systems Monitor',
  },
};

function resolveColor(color) {
  if (!color) return COLORS.primary;
  return COLORS[color] || color;
}

function toLineBlock(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join('\n');
  }

  return String(value || '').trim();
}

function buildDescription({ summary, sections = [], cta } = {}) {
  const chunks = [];

  if (summary) {
    chunks.push(`✦ **${summary}**`);
  }

  for (const section of sections) {
    if (!section) continue;

    const label = section.label ? `**▸ ${String(section.label).toUpperCase()}**` : '';
    const content = toLineBlock(section.content);
    if (!label && !content) continue;

    chunks.push([label, content].filter(Boolean).join('\n'));
  }

  if (cta) {
    chunks.push(`${SEPARATOR}\n**NEXT PLAY:** ${cta}`);
  }

  return chunks.join('\n\n').trim();
}

function toField(name, value, inline = false) {
  return {
    name,
    value: toLineBlock(value) || 'N/A',
    inline,
  };
}

function titleWithIcon(icon, title) {
  const safeTitle = String(title || 'SYSTEM UPDATE').trim();
  if (!icon) return safeTitle.toUpperCase();
  return `${icon} ${safeTitle.toUpperCase()} ${icon}`;
}

function getPlacementBadge(index) {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return `#${index + 1}`;
}

function makeProgressBar(current, max, length = 10) {
  const safeCurrent = Number.isFinite(Number(current)) ? Math.max(0, Number(current)) : 0;
  const safeMax = Number.isFinite(Number(max)) ? Math.max(1, Number(max)) : 1;
  const ratio = Math.max(0, Math.min(1, safeCurrent / safeMax));
  const filledCount = Math.round(ratio * length);
  return `${'█'.repeat(filledCount)}${'░'.repeat(Math.max(0, length - filledCount))}`;
}

function createStyledEmbed({
  interaction,
  title,
  icon = '🎯',
  description,
  summary,
  sections,
  cta,
  color,
  theme = 'default',
  footerText,
  thumbnailUrl,
} = {}) {
  const selectedTheme = THEMES[theme] || THEMES.default;

  const embed = new EmbedBuilder()
    .setColor(resolveColor(color || selectedTheme.color || 'primary'))
    .setTitle(titleWithIcon(icon, title || 'Competitive Update'));

  const renderedDescription = description || buildDescription({ summary, sections, cta });
  if (renderedDescription) {
    embed.setDescription(renderedDescription);
  }

  const logoFromEnv = process.env.EMBED_LOGO_URL;
  const bannerFromEnv = process.env.EMBED_BANNER_URL;
  const finalThumbnail = thumbnailUrl || logoFromEnv;
  if (finalThumbnail) {
    embed.setThumbnail(finalThumbnail);
  }

  if (bannerFromEnv) {
    embed.setImage(bannerFromEnv);
  }

  if (interaction?.guild?.name) {
    embed.setAuthor({
      name: interaction.guild.name,
      iconURL: interaction.guild.iconURL({ size: 128 }) || undefined,
    });
  }

  embed.setFooter({ text: footerText || selectedTheme.footer || BRAND_FOOTER });
  embed.setTimestamp();
  return embed;
}

module.exports = {
  createStyledEmbed,
  buildDescription,
  toField,
  getPlacementBadge,
  makeProgressBar,
  SEPARATOR,
  COLORS,
  THEMES,
};

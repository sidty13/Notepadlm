/**
 * Shared Clerk `appearance` config so the auth UI (sign-in/up embeds, the
 * account portal modal, the user button popover) all match the notebook
 * theme's paper/ink palette instead of Clerk's default look. Colors are
 * duplicated from globals.css's @theme block since Clerk's appearance API
 * takes literal values, not CSS custom properties.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#2f5d50", // moss
    colorDanger: "#a83b17", // rust
    colorSuccess: "#2f5d50",
    colorWarning: "#9c6f1f", // gold
    colorBackground: "#fffcf3", // surface-raised
    colorInputBackground: "#faf3e2", // surface
    colorText: "#2a2013", // ink
    colorTextSecondary: "#5c4d34", // ink-soft
    colorInputText: "#2a2013",
    borderRadius: "0.125rem",
    fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif',
    fontFamilyButtons: '"Inter", "Helvetica Neue", Arial, sans-serif',
  },
  elements: {
    card: "shadow-none border border-line bg-surface-raised",
    headerTitle: "font-display text-ink",
    headerSubtitle: "text-ink-soft",
    socialButtonsBlockButton:
      "border border-line hover:bg-paper transition text-ink",
    dividerLine: "bg-line",
    dividerText: "text-ink-faint",
    formFieldLabel: "text-ink-soft",
    formFieldInput:
      "border border-line bg-surface focus:border-moss focus:ring-0 rounded-sm",
    formButtonPrimary:
      "press bg-moss hover:bg-moss-dark normal-case shadow-none rounded-sm",
    footerActionLink: "text-moss hover:text-moss-dark",
    identityPreviewEditButton: "text-moss",
    otpCodeFieldInput: "border border-line rounded-sm",
    avatarBox: "rounded-full",
    userButtonPopoverCard: "border border-line shadow-[var(--shadow-drawer)] bg-surface-raised",
    userButtonPopoverActionButton: "hover:bg-paper text-ink",
    userButtonPopoverActionButtonText: "text-ink",
    userButtonPopoverFooter: "hidden",
  },
};

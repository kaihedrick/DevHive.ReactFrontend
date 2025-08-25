/** Stylelint Guardrails for DevHive */
module.exports = {
  extends: ["stylelint-config-standard"],
  ignoreFiles: ["**/node_modules/**", "**/dist/**", "**/build/**"],
  overrides: [
    // Utilities may (sparingly) use !important
    { files: ["src/styles/utilities/**/*.css"], rules: { "declaration-no-important": null } },
    // Component CSS Modules — encourage BEM-ish naming
    {
      files: ["src/**/*.{module.css,module.scss}"],
      rules: {
        "selector-class-pattern": [
          "^[a-z][a-zA-Z0-9]*(?:__[a-zA-Z0-9]+)?(?:--[a-zA-Z0-9]+)?$",
          { resolveNestedSelectors: true }
        ]
      }
    }
  ],
  rules: {
    "declaration-no-important": true,
    "selector-max-id": 0,
    "no-descending-specificity": null,
    "property-no-vendor-prefix": true,
    "value-no-vendor-prefix": true,
    // allow :global/:local when using CSS Modules tooling
    "selector-pseudo-class-no-unknown": [true, { ignorePseudoClasses: ["global", "local"] }]
  }
};

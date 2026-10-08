const inwardRules = ['domain', 'application', 'presentation'].flatMap(
  (layer) => {
    const forbidden =
      layer === 'domain'
        ? '(application|infrastructure|presentation)'
        : layer === 'application'
          ? '(infrastructure|presentation)'
          : 'infrastructure';
    return [
      {
        name: `${layer}-depends-inward`,
        severity: 'error',
        from: { path: `/${layer}/` },
        to: { path: `/(?:${forbidden})/` },
      },
      {
        name: `${layer}-no-platform-runtime`,
        severity: 'error',
        from: { path: `/${layer}/` },
        // Technical modules can have Clean layers under platform as well.
        to: {
          path: '/platform/',
          pathNot: layer === 'domain' ? '/domain/' : '/(domain|application)/',
        },
      },
      ...(layer === 'presentation'
        ? []
        : [
            {
              name: `${layer}-no-framework`,
              severity: 'error',
              from: { path: `/${layer}/` },
              to: {
                dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'],
              },
            },
          ]),
    ];
  },
);
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolved',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    ...inwardRules,
    {
      name: 'context-private',
      severity: 'error',
      from: { path: '/contexts/([^/]+)/' },
      to: {
        path: '/contexts/([^/]+)/(domain|application|infrastructure|presentation)/',
        pathNot: '/contexts/$1/',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js', '.json'] },
  },
};

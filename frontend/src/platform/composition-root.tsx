import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Workbench } from '../presentation/app-shell/workbench';
import { HttpClient } from './http/client';
import { HttpIdentity } from '../contexts/identity/infrastructure/http-identity';
import { HttpFlags } from '../contexts/flags/infrastructure/http-flags';
import { HttpAudit } from '../contexts/audit/infrastructure/http-audit';
import { createCheckReadiness } from './health/application/check-readiness';
import { HttpHealthGateway } from './health/infrastructure/http-health-gateway';
const checkReadiness = createCheckReadiness(
  new HttpHealthGateway(window.fetch.bind(window)),
);
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const http = new HttpClient(window.fetch.bind(window), () => {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== 'session',
  });
  queryClient.setQueryData(['session'], null);
});
const identity = new HttpIdentity(http);
const flags = new HttpFlags(http);
const audit = new HttpAudit(http);
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <Workbench
        identity={identity}
        flags={flags}
        audit={audit}
        checkReadiness={checkReadiness}
      />
    ),
  },
]);
export function CompositionRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

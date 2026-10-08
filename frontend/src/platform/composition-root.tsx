import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { App } from '../presentation/app-shell/app';
import { createCheckReadiness } from './health/application/check-readiness';
import { HttpHealthGateway } from './health/infrastructure/http-health-gateway';
const checkReadiness = createCheckReadiness(
  new HttpHealthGateway(window.fetch.bind(window)),
);
const queryClient = new QueryClient();
const router = createBrowserRouter([
  { path: '*', element: <App checkReadiness={checkReadiness} /> },
]);
export function CompositionRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

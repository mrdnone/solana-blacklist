import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { ValidatorsPage } from './pages/ValidatorsPage.tsx'
import { ValidatorDetailPage } from './pages/ValidatorDetailPage.tsx'
import { EpochsPage } from './pages/EpochsPage.tsx'
import { EpochDetailPage } from './pages/EpochDetailPage.tsx'
import { SourcesPageRoute } from './pages/SourcesPageRoute.tsx'
import { SuggestSourcePage } from './pages/SuggestSourcePage.tsx'
import { MeridianVotingPage } from './pages/MeridianVotingPage.tsx'
import { ApiDocsPage } from './pages/ApiDocsPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'

const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        { index: true,                   element: <HomePage /> },
        { path: 'validators',            element: <ValidatorsPage /> },
        { path: 'validators/:pubkey',    element: <ValidatorDetailPage /> },
        { path: 'epochs',                element: <EpochsPage /> },
        { path: 'epochs/:epoch',         element: <EpochDetailPage /> },
        { path: 'sources',               element: <SourcesPageRoute /> },
        { path: 'sources/suggest',       element: <SuggestSourcePage /> },
        { path: 'vote',                  element: <MeridianVotingPage /> },
        { path: 'vote/:pubkey',          element: <MeridianVotingPage /> },
        { path: 'api-docs',              element: <ApiDocsPage /> },
        { path: '*',                     element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: '/blacklist' },
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

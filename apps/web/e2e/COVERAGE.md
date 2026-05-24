# Spec coverage

Spec contract for the Datadog clone. One row per flow. The spec generator reads this file.

**Legend:** `✅` implemented · `🟡` stubbed (`test.fixme`) · `❌` out of scope · `⚠️` flaky.

## Auth

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 1 | Valid login lands on home              | `POST /auth/login`        | LoginPage | `auth.spec.ts::valid login` | ✅ |
| 2 | Invalid login shows error              | `POST /auth/login`        | LoginPage | `auth.spec.ts::invalid login` | ✅ |
| 3 | Logout clears session                  | `POST /auth/logout`       | LoginPage | `auth.spec.ts::logout` | ✅ |
| 4 | Session persists across reload         | (cookie)                  | LoginPage | `auth.spec.ts::session persistence` | ✅ |
| 5 | Sign-up registers a new user           | `POST /auth/register`     | SignUpPage | — | 🟡 |

## Dashboards

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 6  | Dashboard list renders                | `GET /dashboards`         | DashboardListPage | — | 🟡 |
| 7  | Open a dashboard by id                | `GET /dashboards/{id}`    | DashboardPage     | — | 🟡 |
| 8  | Create a dashboard                    | `POST /dashboards`        | DashboardListPage | — | 🟡 |
| 9  | Edit dashboard widgets                | `PATCH /dashboards/{id}`  | DashboardPage     | — | 🟡 |
| 10 | Delete a dashboard                    | `DELETE /dashboards/{id}` | DashboardListPage | — | 🟡 |

## Metrics

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 11 | Metric summary renders                | `GET /metrics`            | MetricsPage      | — | 🟡 |
| 12 | Metric explorer renders a chart       | `GET /metrics/query`      | MetricExplorePage | — | 🟡 |

## Logs

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 13 | Log explorer renders                  | `GET /logs/search`        | LogsPage         | — | 🟡 |
| 14 | Log pipeline list renders             | `GET /logs/pipelines`     | LogsPipelinesPage | — | 🟡 |
| 15 | Log pipeline detail renders           | `GET /logs/pipelines/{id}` | LogsPipelineDetailPage | — | 🟡 |
| 16 | Log facets render                     | `GET /logs/facets`        | LogsFacetsPage    | — | 🟡 |

## APM

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 17 | Services list renders                 | `GET /apm/services`       | APMServicesPage   | — | 🟡 |
| 18 | Service detail renders                | `GET /apm/services/{id}`  | APMServiceDetailPage | — | 🟡 |
| 19 | Service map renders                   | `GET /apm/service-map`    | APMServiceMapPage  | — | 🟡 |
| 20 | Trace search returns results          | `GET /apm/traces`         | APMTracesPage     | — | 🟡 |
| 21 | Trace detail shows flame graph        | `GET /apm/traces/{id}`    | APMTraceDetailPage | — | 🟡 |

## RUM

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 22 | RUM summary renders                   | `GET /rum/summary`        | RUMSummaryPage    | — | 🟡 |
| 23 | RUM explorer renders                  | `GET /rum/sessions`       | RUMExplorerPage   | — | 🟡 |
| 24 | Session replay opens                  | `GET /rum/sessions/{id}`  | RUMSessionReplayPage | — | 🟡 |

## Synthetics

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 25 | Synthetics test list renders          | `GET /synthetics/tests`   | SyntheticsTestsPage  | — | 🟡 |
| 26 | Create API test                       | `POST /synthetics/api-tests` | SyntheticsNewPage | — | 🟡 |
| 27 | Create browser test                   | `POST /synthetics/browser-tests` | SyntheticsNewPage | — | 🟡 |
| 28 | View synthetic test detail            | `GET /synthetics/tests/{id}` | SyntheticsTestDetailPage | — | 🟡 |
| 29 | Edit synthetic test                   | `PATCH /synthetics/tests/{id}` | SyntheticsTestEditPage | — | 🟡 |
| 30 | Synthetic events list                 | `GET /synthetics/events`  | SyntheticsEventsPage | — | 🟡 |

## Monitors

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 31 | Monitor list renders                  | `GET /monitors`           | MonitorsPage      | `monitors.spec.ts::render` | ✅ |
| 32 | Create a monitor                      | `POST /monitors`          | MonitorCreatePage | — | 🟡 |
| 33 | View monitor detail                   | `GET /monitors/{id}`      | MonitorDetailPage | — | 🟡 |
| 34 | Mute a monitor                        | `POST /monitors/{id}/mute`| MonitorDetailPage | — | 🟡 |
| 35 | Delete a monitor                      | `DELETE /monitors/{id}`   | MonitorsPage      | — | 🟡 |

## SLOs

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 36 | SLO list renders                      | `GET /slos`               | SLOPage           | — | 🟡 |
| 37 | Create an SLO                         | `POST /slos`              | SLOCreatePage     | — | 🟡 |
| 38 | View SLO detail                       | `GET /slos/{id}`          | SLODetailPage     | — | 🟡 |
| 39 | Delete an SLO                         | `DELETE /slos/{id}`       | SLOPage           | — | 🟡 |

## Incidents

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 40 | Incident list renders                 | `GET /incidents`          | IncidentsPage     | — | 🟡 |
| 41 | Incident detail renders               | `GET /incidents/{id}`     | IncidentDetailPage | — | 🟡 |

## Security

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 42 | Security signals list renders         | `GET /security/signals`   | SecuritySignalsPage | — | 🟡 |
| 43 | Detection rule list renders           | `GET /security/rules`     | SecurityRulesPage | — | 🟡 |
| 44 | Create a detection rule               | `POST /security/rules`    | SecurityRuleNewPage | — | 🟡 |
| 45 | Data security overview renders        | `GET /security/data-security` | DataSecurityPage | — | 🟡 |

## CI Visibility

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 46 | Pipelines list renders                | `GET /ci/pipelines`       | CIPipelinesPage   | — | 🟡 |
| 47 | Pipeline executions list renders      | `GET /ci/pipeline-executions` | CIPipelineExecutionsPage | — | 🟡 |
| 48 | Pipeline execution detail renders     | `GET /ci/pipeline-executions/{id}` | CIPipelineExecutionDetailPage | — | 🟡 |
| 49 | Test services list renders            | `GET /ci/test-services`   | CITestServicesPage | — | 🟡 |

## Cost

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 50 | Cost overview renders                 | `GET /cost`               | CostPage          | — | 🟡 |
| 51 | Cost explorer renders                 | `GET /cost/explorer`      | CostExplorerPage  | — | 🟡 |

## Watchdog

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 52 | Watchdog stories list renders         | `GET /watchdog`           | WatchdogPage      | — | 🟡 |
| 53 | Watchdog insight detail renders       | `GET /watchdog/{id}`      | WatchdogInsightPage | — | 🟡 |

## Notebooks

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 54 | Notebook list renders                 | `GET /notebooks`          | NotebookListPage  | — | 🟡 |
| 55 | Create a notebook                     | `POST /notebooks`         | NotebookListPage  | — | 🟡 |
| 56 | Open a notebook                       | `GET /notebooks/{id}`     | NotebookPage      | — | 🟡 |
| 57 | Edit notebook content                 | `PATCH /notebooks/{id}`   | NotebookPage      | — | 🟡 |
| 58 | Delete a notebook                     | `DELETE /notebooks/{id}`  | NotebookListPage  | — | 🟡 |

## Infrastructure

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 59 | Infrastructure catalog renders        | `GET /infra/hosts`        | InfrastructurePage | — | 🟡 |
| 60 | Infrastructure map renders            | `GET /infra/topology`     | InfrastructureMapPage | — | 🟡 |

## Software catalog

| # | Flow | Endpoint / Tool | Page | Spec | Status |
|---|---|---|---|---|---|
| 61 | Software catalog renders              | `GET /apm/services`       | SoftwarePage      | — | 🟡 |

---

**Total rows:** 61 (target band 50–70 per universal acceptance §5b). Auth + Monitors are implemented (✅); everything else is stubbed (`test.fixme`) and unblocks the spec generator. Testid coverage for the deferred surfaces lags behind per §9 exception — see [HANDBOOK.md §3](HANDBOOK.md#3-testid-conventions) for the naming a deferred spec will rely on.

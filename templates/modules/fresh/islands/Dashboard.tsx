/**
 * Dashboard Island Component
 * Real-time health check dashboard for TSera components
 */

import { useEffect, useState } from "preact/hooks";

interface HealthStatus {
  status: "operational" | "degraded" | "down";
  latency: number;
  statusCode: number;
  lastCheck: string;
  message: string;
}

interface HealthData {
  api: HealthStatus;
  database: HealthStatus;
  secrets: HealthStatus;
}

const REFRESH_INTERVAL = 5000;

export default function Dashboard() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>("");

  const fetchHealthData = async () => {
    try {
      setIsRefreshing(true);

      const [apiResponse, dbResponse, secretsResponse] = await Promise.allSettled([
        fetch("/api/health").then((res) => res.json()),
        fetch("/api/health/db").then((res) => res.json()),
        fetch("/api/health/secrets").then((res) => res.json()),
      ]);

      const apiHealth = apiResponse.status === "fulfilled" ? apiResponse.value : null;
      const dbHealth = dbResponse.status === "fulfilled" ? dbResponse.value : null;
      const secretsHealth = secretsResponse.status === "fulfilled" ? secretsResponse.value : null;

      const newData: HealthData = {
        api: apiHealth || createErrorHealth("API"),
        database: dbHealth || createErrorHealth("Database"),
        secrets: secretsHealth || createErrorHealth("Secret Manager"),
      };

      setHealthData(newData);
      setLastRefresh(new Date().toISOString());
    } catch (error) {
      console.error("Failed to fetch health data:", error);
      setHealthData({
        api: createErrorHealth("API"),
        database: createErrorHealth("Database"),
        secrets: createErrorHealth("Secret Manager"),
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const createErrorHealth = (component: string): HealthStatus => ({
    status: "down",
    latency: 0,
    statusCode: 0,
    lastCheck: new Date().toISOString(),
    message: `${component} unavailable`,
  });

  useEffect(() => {
    fetchHealthData();

    const interval = setInterval(() => {
      fetchHealthData();
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const getStatusConfig = (status: HealthStatus["status"]) => {
    switch (status) {
      case "operational":
        return {
          color: "text-emerald-400",
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/20",
          dot: "bg-emerald-400",
        };
      case "degraded":
        return {
          color: "text-amber-400",
          bg: "bg-amber-500/10",
          border: "border-amber-500/20",
          dot: "bg-amber-400",
        };
      case "down":
        return {
          color: "text-rose-400",
          bg: "bg-rose-500/10",
          border: "border-rose-500/20",
          dot: "bg-rose-400",
        };
    }
  };

  const formatLatency = (latency: number): string => {
    return latency < 1000 ? `${latency}ms` : `${(latency / 1000).toFixed(2)}s`;
  };

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  };

  return (
    <section class="min-h-screen bg-slate-950 py-16 px-4 sm:px-6 lg:px-8">
      <div class="max-w-6xl mx-auto">
        {/* Header */}
        <div class="text-center mb-16">
          <h1 class="text-5xl sm:text-6xl font-bold text-white mb-4 tracking-tight">
            System Status
          </h1>
          <p class="text-lg text-slate-400 max-w-2xl mx-auto">
            Real-time monitoring of TSera infrastructure components
          </p>
        </div>

        {/* Refresh Button */}
        <div class="flex justify-center mb-12">
          <button
            type="button"
            onClick={fetchHealthData}
            disabled={isRefreshing}
            class={`group relative px-6 py-3 rounded-xl font-medium text-white transition-all duration-300 ${
              isRefreshing
                ? "bg-slate-700 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5"
            }`}
          >
            <span class="flex items-center gap-2">
              {isRefreshing ? (
                <svg
                  class="animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              ) : (
                <svg
                  class="transition-transform duration-300 group-hover:rotate-180"
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              )}
              {isRefreshing ? "Refreshing..." : "Refresh Now"}
            </span>
          </button>
        </div>

        {/* Last Updated */}
        {lastRefresh && (
          <div class="text-center mb-12">
            <span class="text-slate-500 text-sm">
              Last updated: {formatTime(lastRefresh)}
            </span>
            <span class="text-slate-600 text-sm ml-2">
              (auto-refresh every 5s)
            </span>
          </div>
        )}

        {/* Health Cards */}
        {isLoading ? (
          <div class="flex justify-center py-20">
            <div class="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* API Health Card */}
            <HealthCard
              title="Backend API"
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
              }
              health={healthData?.api}
              getStatusConfig={getStatusConfig}
              formatLatency={formatLatency}
              formatTime={formatTime}
            />

            {/* Database Health Card */}
            <HealthCard
              title="Database"
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              }
              health={healthData?.database}
              getStatusConfig={getStatusConfig}
              formatLatency={formatLatency}
              formatTime={formatTime}
            />

            {/* Secrets Health Card */}
            <HealthCard
              title="Secret Manager"
              icon={
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              }
              health={healthData?.secrets}
              getStatusConfig={getStatusConfig}
              formatLatency={formatLatency}
              formatTime={formatTime}
            />
          </div>
        )}

        {/* System Status Summary */}
        {healthData && (() => {
          const isAllOperational =
            healthData.api.status === "operational" &&
            healthData.database.status === "operational" &&
            healthData.secrets.status === "operational";
          const overallStatus = isAllOperational ? "operational" : "down";
          const statusConfig = getStatusConfig(overallStatus);

          return (
            <div class="mt-16 text-center">
              <div class={`inline-flex items-center gap-4 px-8 py-4 rounded-2xl ${statusConfig.bg} ${statusConfig.border} border`}>
                <span class="text-slate-400 font-medium">Overall Status:</span>
                <span class={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${statusConfig.color}`}>
                  <span class={`relative flex h-3 w-3`}>
                    <span class={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusConfig.dot} opacity-75`} />
                    <span class={`relative inline-flex rounded-full h-3 w-3 ${statusConfig.dot}`} />
                  </span>
                  {isAllOperational ? "All Systems Operational" : "System Degraded"}
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </section>
  );
}

interface HealthCardProps {
  title: string;
  icon: JSX.Element;
  health?: HealthStatus;
  getStatusConfig: (status: HealthStatus["status"]) => ReturnType<typeof Dashboard.prototype.getStatusConfig>;
  formatLatency: (latency: number) => string;
  formatTime: (isoString: string) => string;
}

function HealthCard(props: HealthCardProps) {
  const { title, icon, health, getStatusConfig, formatLatency, formatTime } = props;

  if (!health) {
    return null;
  }

  const statusConfig = getStatusConfig(health.status);

  return (
    <div class={`bg-slate-900/50 border border-slate-800 rounded-2xl p-6 transition-all duration-300 hover:border-slate-700 hover:shadow-xl hover:shadow-slate-900/10`}>
      {/* Card Header */}
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <span class={`flex items-center justify-center w-12 h-12 rounded-xl ${statusConfig.bg}`}>
            <span class={statusConfig.color}>
              {icon}
            </span>
          </span>
          <div>
            <h3 class="text-lg font-semibold text-white">{title}</h3>
            <span class={`text-sm font-medium capitalize ${statusConfig.color}`}>
              {health.status}
            </span>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div class="space-y-4">
        {/* Latency */}
        <div class="flex items-center justify-between py-3 border-b border-slate-800">
          <span class="text-slate-400 text-sm">Latency</span>
          <span class={`font-mono font-semibold ${statusConfig.color}`}>
            {formatLatency(health.latency)}
          </span>
        </div>

        {/* Status Code */}
        <div class="flex items-center justify-between py-3 border-b border-slate-800">
          <span class="text-slate-400 text-sm">Status Code</span>
          <span class="font-mono font-semibold text-white">
            {health.statusCode}
          </span>
        </div>

        {/* Last Check */}
        <div class="flex items-center justify-between py-3 border-b border-slate-800">
          <span class="text-slate-400 text-sm">Last Check</span>
          <span class="font-mono text-sm text-slate-300">
            {formatTime(health.lastCheck)}
          </span>
        </div>

        {/* Message */}
        <div class="pt-3">
          <p class="text-sm text-slate-300">
            {health.message}
          </p>
        </div>
      </div>
    </div>
  );
}

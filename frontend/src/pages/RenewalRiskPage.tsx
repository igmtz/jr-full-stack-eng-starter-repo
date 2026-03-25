import { useState } from "react";
import { useParams, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiskSignals {
  daysToExpiryDays: number;
  paymentHistoryDelinquent: boolean;
  noRenewalOfferYet: boolean;
  rentGrowthAboveMarket: boolean;
}

interface ResidentRisk {
  residentId: string;
  name: string;
  unitId: string;
  unitNumber: string;
  riskScore: number;
  riskTier: "high" | "medium" | "low";
  daysToExpiry: number;
  signals: RiskSignals;
}

interface RiskResponse {
  propertyId: string;
  calculatedAt: string;
  totalResidents: number;
  riskTiers: { high: number; medium: number; low: number };
  residents: ResidentRisk[];
}

type PageStatus = "idle" | "loading" | "success" | "error";
type TierFilter = "all" | "high" | "medium" | "low";

// ---------------------------------------------------------------------------
// Small helpers (defined here to avoid a separate file for two functions)
// ---------------------------------------------------------------------------

function RiskBadge({ tier }: { tier: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-red-100 text-red-800 border-red-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    low: "bg-green-100 text-green-800 border-green-200",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase border ${styles[tier]}`}
    >
      {tier}
    </span>
  );
}

function SignalBreakdown({ signals }: { signals: RiskSignals }) {
  const items = [
    {
      label: "Days to expiry",
      value: `${signals.daysToExpiryDays}d`,
      flagged: signals.daysToExpiryDays <= 90,
    },
    {
      label: "Delinquent",
      value: signals.paymentHistoryDelinquent ? "Yes" : "No",
      flagged: signals.paymentHistoryDelinquent,
    },
    {
      label: "No renewal offer",
      value: signals.noRenewalOfferYet ? "Yes" : "No",
      flagged: signals.noRenewalOfferYet,
    },
    {
      label: "Rent above market",
      value: signals.rentGrowthAboveMarket ? "Yes" : "No",
      flagged: signals.rentGrowthAboveMarket,
    },
  ];
  return (
    <div className="flex gap-3 flex-wrap">
      {items.map(({ label, value, flagged }) => (
        <span
          key={label}
          className={`text-xs px-2 py-1 rounded border ${
            flagged
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-gray-50 border-gray-200 text-gray-500"
          }`}
        >
          {label}: <strong>{value}</strong>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function RenewalRiskPage() {
  const { propertyId } = useParams<{ propertyId: string }>();

  const [status, setStatus] = useState<PageStatus>("idle");
  const [data, setData] = useState<RiskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  async function calculate() {
    setStatus("loading");
    setError(null);
    setExpandedRows(new Set());
    try {
      const res = await fetch(
        `${API_URL}/api/v1/properties/${propertyId}/renewal-risk/calculate`,
        { method: "POST" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      setData(await res.json());
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setStatus("error");
    }
  }

  function toggleRow(residentId: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(residentId) ? next.delete(residentId) : next.add(residentId);
      return next;
    });
  }

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const filtered =
    data?.residents.filter(
      (r) => tierFilter === "all" || r.riskTier === tierFilter
    ) ?? [];

  const isLoading = status === "loading";

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link to="/" className="text-sm text-blue-600 hover:underline mb-1 block">
            ← All Properties
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Renewal Risk Dashboard</h1>
        </div>
        <button
          onClick={calculate}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isLoading
            ? "Calculating…"
            : status === "success"
            ? "Recalculate"
            : "Calculate Risk Scores"}
        </button>
      </div>

      {/* Idle */}
      {status === "idle" && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
          <p className="text-lg font-medium mb-1">No data yet</p>
          <p className="text-sm">
            Click "Calculate Risk Scores" to score all active residents.
          </p>
        </div>
      )}

      {/* Loading */}
      {status === "loading" && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-400">
          <p className="text-lg">Calculating scores…</p>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          <p className="font-semibold mb-1">Calculation failed</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Success */}
      {status === "success" && data && (
        <>
          {/* Tier summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {(["high", "medium", "low"] as const).map((tier) => {
              const colors = {
                high: "border-red-200 bg-red-50 text-red-800",
                medium: "border-yellow-200 bg-yellow-50 text-yellow-800",
                low: "border-green-200 bg-green-50 text-green-800",
              };
              return (
                <div key={tier} className={`rounded-lg border p-4 ${colors[tier]}`}>
                  <div className="text-3xl font-bold">{data.riskTiers[tier]}</div>
                  <div className="text-sm font-medium capitalize">{tier} Risk</div>
                </div>
              );
            })}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-2 mb-4">
            {(["all", "high", "medium", "low"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTierFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  tierFilter === f
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f === "all"
                  ? `All (${data.totalResidents})`
                  : `${f.charAt(0).toUpperCase() + f.slice(1)} (${data.riskTiers[f]})`}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400">
              Calculated {new Date(data.calculatedAt).toLocaleString()}
            </span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium w-1/4">
                    Resident
                  </th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Unit</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">
                    Days to Expiry
                  </th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">
                    Risk Score
                  </th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">
                    Risk Tier
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      No residents in this tier.
                    </td>
                  </tr>
                ) : (
                  filtered.map((resident) => {
                    const expanded = expandedRows.has(resident.residentId);
                    return (
                      <>
                        <tr
                          key={resident.residentId}
                          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleRow(resident.residentId)}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <span className="mr-1.5 text-gray-400 text-xs">
                              {expanded ? "▾" : "▸"}
                            </span>
                            {resident.name}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {resident.unitNumber}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                resident.daysToExpiry <= 30
                                  ? "text-red-600 font-semibold"
                                  : resident.daysToExpiry <= 90
                                  ? "text-yellow-600 font-medium"
                                  : "text-gray-600"
                              }
                            >
                              {resident.daysToExpiry}d
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    resident.riskScore >= 70
                                      ? "bg-red-500"
                                      : resident.riskScore >= 40
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                                  }`}
                                  style={{ width: `${resident.riskScore}%` }}
                                />
                              </div>
                              <span className="text-gray-700 font-medium tabular-nums">
                                {resident.riskScore}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <RiskBadge tier={resident.riskTier} />
                          </td>
                        </tr>
                        {/* Signal breakdown row */}
                        {expanded && (
                          <tr key={`${resident.residentId}-signals`}>
                            <td
                              colSpan={5}
                              className="px-6 py-3 bg-blue-50 border-b border-gray-100"
                            >
                              <SignalBreakdown signals={resident.signals} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default RenewalRiskPage;

import { useParams } from "react-router-dom";

/**
 * TODO: Build your Renewal Risk Dashboard here.
 *
 * This page should:
 * 1. Display a button to trigger the risk calculation (POST to your API)
 * 2. Fetch and display the risk results in a table
 * 3. Show loading and error states
 *
 * See the project spec for full requirements:
 * - Table columns: Resident name, Unit number, Days to expiry, Risk score, Risk tier
 * - Risk tiers should be color-coded: red (high), yellow (medium), green (low)
 *
 * The API_URL helper is available if you need it:
 *   const API_URL = import.meta.env.VITE_API_URL || "";
 */

function RenewalRiskPage() {
  const { propertyId } = useParams<{ propertyId: string }>();

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Renewal Risk Dashboard
      </h1>
      <p className="text-gray-500 mb-4">Property: {propertyId}</p>

      {/* TODO: Replace this placeholder with your dashboard implementation */}
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
        <p className="text-lg mb-2">Your dashboard goes here.</p>
        <p className="text-sm">
          Start by adding a button to trigger the risk calculation, then display
          the results in a table.
        </p>
      </div>
    </div>
  );
}

export default RenewalRiskPage;

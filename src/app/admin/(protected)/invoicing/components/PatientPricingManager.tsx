'use client';

import type { PatientPriceOverrideDto } from '@/lib/invoicing/priceLists';
import type { TreatmentCodeDto } from '@/lib/invoicing/treatments';

import PatientOverridesPanel from './PatientOverridesPanel';
import PatientPriceListAssignment from './PatientPriceListAssignment';

interface PatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

interface Props {
  csrf: string;
  patient: PatientSummary;
  assignment: {
    priceListId: string | null;
    priceListName: string | null;
  };
  priceLists: Array<{ id: string; name: string; isDefault: boolean; active: boolean }>;
  overrides: PatientPriceOverrideDto[];
  treatments: TreatmentCodeDto[];
}

export default function PatientPricingManager({
  csrf,
  patient,
  assignment,
  priceLists,
  overrides,
  treatments,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Patient</h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Name</div>
            <div className="text-slate-800">
              {patient.firstName} {patient.lastName}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Email</div>
            <div className="text-slate-800">{patient.email ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Phone</div>
            <div className="text-slate-800">{patient.phone ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-slate-500">Price list</div>
            <div className="text-slate-800">{assignment.priceListName ?? 'Uses default'}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Price list assignment</h2>
        <p className="mt-1 text-sm text-slate-600">
          Assign a specific price list to this patient. Leave empty to fall back to the practice
          default.
        </p>
        <div className="mt-3 max-w-lg">
          <PatientPriceListAssignment
            csrf={csrf}
            patientId={patient.id}
            priceLists={priceLists}
            assignment={assignment}
          />
        </div>
      </div>

      <PatientOverridesPanel
        csrf={csrf}
        patientId={patient.id}
        overrides={overrides}
        treatments={treatments}
      />
    </div>
  );
}

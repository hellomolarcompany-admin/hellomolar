'use client';

import { useEffect, useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldErrors } from 'react-hook-form';
import { useForm, useWatch } from 'react-hook-form';

import {
  CountryEnum,
  GenderEnum,
  type IntakeFormData,
  IntakeSchema,
  RelationEnum,
} from '@/lib/validation/intake';
import Button from '@/ui/Button';
import Checkbox from '@/ui/Checkbox';

export default function IntakeForm() {
  /**
   * Intake form rendered as a client component.
   * Uses react-hook-form with Zod for validation and next-intl for i18n.
   */
  const t = useTranslations('intake');
  const router = useRouter();

  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [serverMsgType, setServerMsgType] = useState<'success' | 'error' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationItems, setValidationItems] = useState<Array<{ path: string; message: string }>>(
    [],
  );
  const [showServerModal, setShowServerModal] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    setValue,
    getValues,
  } = useForm<IntakeFormData>({
    resolver: zodResolver(IntakeSchema),
    // Prevent auto-focusing the first error, which can cause scroll jumps
    shouldFocusError: false,
    // Unregister inputs when unmounted so hidden fields (e.g., resident-only)
    // do not submit empty strings and trigger validation for tourists.
    shouldUnregister: true,
    defaultValues: {
      residentType: 'resident',
      gender: 'other',
      address: {
        street: '',
        number: '',
        city: '',
        country: 'Bonaire',
        countryOther: '',
        postalCode: '',
      },
      phone1: { number: '', hasWhatsApp: true },
      // phone2 is optional; omit by default so validation won't require it
      email: '',
      emergencyContact: { name: '', relation: 'overig', phone: '' },
      medical: {
        medicationsSelected: [],
        medicationDetails: { bloedverdunners: '', diabetesmedicatie: '', anders: '' },
        allergiesSelected: [],
        allergyDetails: { anders: '' },
        conditions: {
          hartziekte: false,
          hogeBloeddruk: false,
          diabetes: false,
          bloedingsstoornis: false,
          schildklier: false,
          epilepsie: false,
          astma: false,
          nierOfLever: false,
          kunstgewricht: false,
          endocarditisProfylaxe: false,
          zwangerschap: false,
        },
        smokingStatus: 'nooit',
        alcoholPerWeek: '0',
        lastDentalVisit: 'onbekend',
        brushingFreq: '2x/dag',
        flossingFreq: 'soms',
        dentalAnxiety: 'mild',
        complicationsBefore: 'nee',
        complicationsDetails: '',
      },
      marketingConsent: false,
      privacyConsent: false,
    },
    // Validate only on submit to avoid mid-typing jumps
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
  });

  // Safely read a nested `message` string without using `any`.
  function getErrMsg(node: unknown): string | undefined {
    if (!node || typeof node !== 'object') return undefined;
    if ('message' in node) {
      const msg = (node as { message?: unknown }).message;
      return typeof msg === 'string' ? msg : undefined;
    }
    return undefined;
  }

  const residentType = useWatch({ control, name: 'residentType' });
  const selectedCountry = useWatch({ control, name: 'address.country' });
  const medsSelected = (useWatch({ control, name: 'medical.medicationsSelected' }) ||
    []) as IntakeFormData['medical']['medicationsSelected'];
  const allergiesSelected = (useWatch({ control, name: 'medical.allergiesSelected' }) ||
    []) as IntakeFormData['medical']['allergiesSelected'];
  const complicationsBefore = useWatch({ control, name: 'medical.complicationsBefore' });

  useEffect(() => {
    if (residentType === 'resident') {
      setValue('address.postalCode', '');
      setValue('address.country', 'Bonaire');
      setValue('address.countryOther', '');
    } else {
      setValue('address.country', getValues('address.country') || 'Nederland');
    }
  }, [residentType, setValue, getValues]);

  const genderOptions = useMemo(
    () =>
      GenderEnum.options.map((g) => (
        <option key={g} value={g}>
          {t(`options.gender.${g}`)}
        </option>
      )),
    [t],
  );

  const relationOptions = useMemo(
    () =>
      RelationEnum.options.map((r) => (
        <option key={r} value={r}>
          {t(`options.relation.${r}`)}
        </option>
      )),
    [t],
  );

  const countryOptions = useMemo(
    () =>
      CountryEnum.options.map((c) => (
        <option key={c} value={c}>
          {t(`options.country.${c}`)}
        </option>
      )),
    [t],
  );

  type MedOpt = IntakeFormData['medical']['medicationsSelected'][number];
  type AllergyOpt = IntakeFormData['medical']['allergiesSelected'][number];

  /**
   * Toggle a value in a react-hook-form array field.
   * Ensures mutual exclusivity for the special option 'geen' (none).
   */
  const toggleArray = (
    field: 'medical.medicationsSelected' | 'medical.allergiesSelected',
    value: MedOpt | AllergyOpt,
  ) => {
    const current = (getValues(field) as (MedOpt | AllergyOpt)[]) || [];
    const isOn = current.includes(value);
    let next = isOn ? current.filter((v) => v !== value) : [...current, value];

    if (value === 'geen' && !isOn) {
      next = ['geen'] as typeof next;
    } else if (value !== 'geen') {
      next = next.filter((v) => v !== 'geen') as typeof next;
    }

    if (field === 'medical.medicationsSelected') {
      setValue(field, next as MedOpt[], { shouldValidate: true, shouldDirty: true });
    } else {
      setValue(field, next as AllergyOpt[], { shouldValidate: true, shouldDirty: true });
    }
  };

  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [formTs] = useState<number>(() => Date.now());

  useEffect(() => {
    const sitekey = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY;
    if (!sitekey) return;
    const id = 'hcaptcha-script';
    if (document.getElementById(id)) return;
    const s = document.createElement('script');
    s.id = id;
    s.src = 'https://js.hcaptcha.com/1/api.js';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const token = (e as CustomEvent<string>).detail;
      setCaptchaToken(String(token || ''));
    };
    window.addEventListener('hcaptcha-verified', handler as EventListener);
    return () => window.removeEventListener('hcaptcha-verified', handler as EventListener);
  }, []);

  const onSubmit = async (values: IntakeFormData) => {
    setSubmitting(true);
    setServerMsg(null);
    setServerMsgType(null);
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, captchaToken, formTs }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `Server error (${res.status})`);
      }

      setServerMsg(t('server.success'));
      setServerMsgType('success');
      setShowServerModal(true);
      // Do not reset immediately; navigate after modal closes
    } catch {
      setServerMsg(t('server.error'));
      setServerMsgType('error');
      setShowServerModal(true);
    } finally {
      setSubmitting(false);
    }
  };

  const pathToLabelKey: Record<string, string> = {
    residentType: 'residentType',
    firstName: 'firstName',
    lastName: 'lastName',
    gender: 'gender',
    dateOfBirth: 'dateOfBirth',
    'address.street': 'street',
    'address.number': 'number',
    'address.city': 'city',
    'address.postalCode': 'postalCode',
    'address.country': 'country',
    'address.countryOther': 'countryOther',
    'phone1.number': 'phone1',
    'phone2.number': 'phone2',
    email: 'email',
    'emergencyContact.name': 'emergencyName',
    'emergencyContact.relation': 'emergencyRelation',
    'emergencyContact.phone': 'emergencyPhone',
    sedulaNumber: 'sedulaNumber',
    primaryPhysician: 'primaryPhysician',
    'medical.lastDentalVisit': 'lastDentalVisit',
    'medical.brushingFreq': 'brushingFreq',
    'medical.flossingFreq': 'flossingFreq',
    'medical.dentalAnxiety': 'dentalAnxiety',
    'medical.medicationsSelected': 'medications',
    'medical.medicationDetails.bloedverdunners': 'med_bloedverdunners',
    'medical.medicationDetails.diabetesmedicatie': 'med_diabetes',
    'medical.medicationDetails.anders': 'med_other',
    'medical.allergiesSelected': 'allergies',
    'medical.allergyDetails.anders': 'allergy_other',
    'medical.complicationsBefore': 'complicationsBefore',
    'medical.complicationsDetails': 'complicationsDetails',
    marketingConsent: 'marketingConsent',
    privacyConsent: 'privacyConsent',
  };

  const getByPath = (obj: unknown, path: string): unknown => {
    if (!obj) return undefined;
    return path.split('.').reduce<unknown>((acc, key) => {
      if (!acc || typeof acc !== 'object') return undefined;
      return (acc as Record<string, unknown>)[key];
    }, obj);
  };

  const collectErrorItems = (
    errs: FieldErrors<IntakeFormData>,
  ): Array<{ path: string; message: string }> => {
    const items: Array<{ path: string; message: string }> = [];
    for (const path of Object.keys(pathToLabelKey)) {
      const node = getByPath(errs, path);
      const msg = getErrMsg(node);
      if (msg) items.push({ path, message: msg });
    }
    return items;
  };

  const onInvalid = (errs: FieldErrors<IntakeFormData>) => {
    const items = collectErrorItems(errs);
    setValidationItems(items);
    setShowValidationModal(true);
    if (process.env.NODE_ENV !== 'production') {
      try {
        // Developer diagnostics (local only)
        // Show a compact table of invalid fields + messages and a snapshot of current values
        // Note: contains PII; do not enable in production

        console.groupCollapsed('Intake validation errors');

        console.table(
          items.map((it) => ({
            path: it.path,
            label: pathToLabelKey[it.path] || '',
            message: it.message,
          })),
        );

        console.log('residentType:', residentType);

        console.log('formValues:', getValues());

        console.groupEnd();
      } catch {
        // ignore logging failures
      }
    }
  };

  // Auto-dismiss server modal after ~8 seconds
  useEffect(() => {
    if (!showServerModal) return;
    const id = setTimeout(() => {
      setShowServerModal(false);
      setServerMsg(null);
      const wasSuccess = serverMsgType === 'success';
      setServerMsgType(null);
      if (wasSuccess) router.push('/');
    }, 8000);
    return () => clearTimeout(id);
  }, [showServerModal, serverMsgType, router]);

  const ErrorText = ({ msg }: { msg?: string }) =>
    msg ? <p className="mt-1 text-sm text-red-600">{msg}</p> : null;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="section space-y-4">
      <h2 className="text-lg font-semibold heading-title normal-case">{title}</h2>
      {children}
    </section>
  );

  // Strictly typed condition keys used to render checkboxes.
  const conditionEntries: Array<[keyof IntakeFormData['medical']['conditions'], string]> = [
    ['hartziekte', t('cond.hartziekte')],
    ['hogeBloeddruk', t('cond.hogeBloeddruk')],
    ['diabetes', t('cond.diabetes')],
    ['bloedingsstoornis', t('cond.bloedingsstoornis')],
    ['schildklier', t('cond.schildklier')],
    ['epilepsie', t('cond.epilepsie')],
    ['astma', t('cond.astma')],
    ['nierOfLever', t('cond.nierOfLever')],
    ['kunstgewricht', t('cond.kunstgewricht')],
    ['endocarditisProfylaxe', t('cond.endocarditisProfylaxe')],
    ['zwangerschap', t('cond.zwangerschap')],
  ];

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      noValidate
      className="prevent-scroll-anchor mx-auto max-w-3xl space-y-6 p-4"
    >
      {/* hCaptcha widget (optional, shown if configured) */}
      {process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY ? (
        <div className="mb-2">
          <div
            className="h-captcha"
            data-sitekey={process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY}
            data-callback="onHCaptchaVerify"
          />
        </div>
      ) : null}
      <h1 className="text-2xl heading-title">{t('title')}</h1>

      {showServerModal && serverMsg && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            const wasSuccess = serverMsgType === 'success';
            setShowServerModal(false);
            setServerMsg(null);
            setServerMsgType(null);
            if (wasSuccess) router.push('/');
          }}
        >
          <div
            className={
              'w-full max-w-md rounded-md p-4 shadow ' +
              (serverMsgType === 'success'
                ? 'bg-green-50 text-green-900'
                : 'bg-red-50 text-red-900')
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="text-lg font-medium">{t('title')}</h2>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-black/10"
                aria-label={t('buttons.close')}
                onClick={() => {
                  const wasSuccess = serverMsgType === 'success';
                  setShowServerModal(false);
                  setServerMsg(null);
                  setServerMsgType(null);
                  if (wasSuccess) router.push('/');
                }}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            <p className="text-sm">{serverMsg}</p>
          </div>
        </div>
      )}

      {showValidationModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowValidationModal(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-md bg-white p-4 shadow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <h2 className="text-lg font-medium">{t('validation.modalTitle')}</h2>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-black/10"
                aria-label={t('buttons.close')}
                onClick={() => setShowValidationModal(false)}
              >
                <span aria-hidden>×</span>
              </button>
            </div>
            {validationItems.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {validationItems.map((it, i) => {
                  const labelKey = pathToLabelKey[it.path];
                  const label = labelKey ? t(`labels.${labelKey}`) : undefined;
                  return (
                    <li key={`${it.path}-${i}`}>
                      {label ? (
                        <>
                          <span className="font-medium">{label}:</span> {it.message}
                        </>
                      ) : (
                        it.message
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm">{t('validation.generic')}</p>
            )}
          </div>
        </div>
      )}

      {/* Spam honeypot (hidden field) */}
      <div className="hidden" aria-hidden="true">
        <label className="block text-sm font-medium">{t('honeypot')}</label>
        <input
          type="text"
          autoComplete="off"
          {...register('botField')}
          className="mt-1 w-full rounded-md border p-2"
        />
      </div>
      {/* Form timestamp for min fill-time checks */}
      <input type="hidden" name="formTs" value={String(formTs)} readOnly />

      {/* Residence */}
      <Section title={t('sections.residence')}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">{t('labels.residentType')}</label>
            <select {...register('residentType')} className="mt-1 w-full rounded-md border p-2">
              <option value="resident">{t('options.residentType.resident')}</option>
              <option value="tourist">{t('options.residentType.tourist')}</option>
            </select>
            <ErrorText msg={errors.residentType?.message} />
          </div>
        </div>
      </Section>

      {/* Personal details */}
      <Section title={t('sections.person')}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">{t('labels.firstName')}</label>
            <input
              type="text"
              {...register('firstName')}
              className="mt-1 w-full rounded-md border p-2"
            />
            <ErrorText msg={errors.firstName?.message} />
          </div>
          <div>
            <label className="block text-sm font-medium">{t('labels.lastName')}</label>
            <input
              type="text"
              {...register('lastName')}
              className="mt-1 w-full rounded-md border p-2"
            />
            <ErrorText msg={errors.lastName?.message} />
          </div>
          <div>
            <label className="block text-sm font-medium">{t('labels.gender')}</label>
            <select {...register('gender')} className="mt-1 w-full rounded-md border p-2">
              {genderOptions}
            </select>
            <ErrorText msg={errors.gender?.message} />
          </div>
          <div>
            <label className="block text-sm font-medium">{t('labels.dateOfBirth')}</label>
            <input
              type="date"
              {...register('dateOfBirth')}
              className="mt-1 w-full rounded-md border p-2"
            />
            <ErrorText msg={errors.dateOfBirth?.message} />
          </div>
        </div>
      </Section>

      {/* Address & contact */}
      <Section title={t('sections.addressContact')}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">{t('labels.street')}</label>
            <input
              type="text"
              {...register('address.street')}
              className="mt-1 w-full rounded-md border p-2"
            />
            <ErrorText msg={errors.address?.street?.message} />
          </div>
          <div>
            <label className="block text-sm font-medium">{t('labels.number')}</label>
            <input
              type="text"
              {...register('address.number')}
              className="mt-1 w-full rounded-md border p-2"
            />
            <ErrorText msg={errors.address?.number?.message} />
          </div>
          <div>
            <label className="block text-sm font-medium">{t('labels.city')}</label>
            <input
              type="text"
              {...register('address.city')}
              className="mt-1 w-full rounded-md border p-2"
            />
            <ErrorText msg={errors.address?.city?.message} />
          </div>

          {residentType === 'tourist' && (
            <>
              <div>
                <label className="block text-sm font-medium">{t('labels.postalCode')}</label>
                <input
                  type="text"
                  {...register('address.postalCode')}
                  className="mt-1 w-full rounded-md border p-2"
                />
                <ErrorText msg={errors.address?.postalCode?.message} />
              </div>
              <div>
                <label className="block text-sm font-medium">{t('labels.country')}</label>
                <select
                  {...register('address.country')}
                  className="mt-1 w-full rounded-md border p-2"
                >
                  {countryOptions}
                </select>
                <ErrorText msg={errors.address?.country?.message} />
              </div>

              {selectedCountry === 'Overig' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium">{t('labels.countryOther')}</label>
                  <input
                    type="text"
                    {...register('address.countryOther')}
                    className="mt-1 w-full rounded-md border p-2"
                  />
                  <ErrorText msg={errors.address?.countryOther?.message} />
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium">{t('labels.phone1')}</label>
            <input
              type="tel"
              {...register('phone1.number')}
              className="mt-1 w-full rounded-md border p-2"
              inputMode="tel"
            />
            <ErrorText msg={errors.phone1?.number?.message} />
            <label className="mt-2 flex items-center gap-2 text-sm">
              <Checkbox {...register('phone1.hasWhatsApp')} />
              <span>{t('labels.hasWhatsApp')}</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium">{t('labels.phone2')}</label>
            <input
              type="tel"
              {...register('phone2.number', {
                setValueAs: (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
              })}
              className="mt-1 w-full rounded-md border p-2"
              inputMode="tel"
            />
            <ErrorText msg={errors.phone2?.number?.message} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium">{t('labels.email')}</label>
            <input
              type="email"
              {...register('email')}
              className="mt-1 w-full rounded-md border p-2"
              inputMode="email"
            />
            <ErrorText msg={errors.email?.message} />
          </div>
        </div>
      </Section>

      {/* Emergency contact */}
      <Section title={t('sections.emergency')}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium">{t('labels.emergencyName')}</label>
            <input
              type="text"
              {...register('emergencyContact.name')}
              className="mt-1 w-full rounded-md border p-2"
            />
            <ErrorText msg={errors.emergencyContact?.name?.message} />
          </div>
          <div>
            <label className="block text-sm font-medium">{t('labels.emergencyRelation')}</label>
            <select
              {...register('emergencyContact.relation')}
              className="mt-1 w-full rounded-md border p-2"
            >
              {relationOptions}
            </select>
            <ErrorText msg={errors.emergencyContact?.relation?.message} />
          </div>
          <div>
            <label className="block text-sm font-medium">{t('labels.emergencyPhone')}</label>
            <input
              type="tel"
              {...register('emergencyContact.phone')}
              className="mt-1 w-full rounded-md border p-2"
              inputMode="tel"
            />
            <ErrorText msg={errors.emergencyContact?.phone?.message} />
          </div>
        </div>
      </Section>

      {/* Residency-specific (Bonaire) */}
      {residentType === 'resident' && (
        <Section title={t('sections.bonaireSpecific')}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">{t('labels.sedulaNumber')}</label>
              <input
                type="text"
                {...register('sedulaNumber')}
                className="mt-1 w-full rounded-md border p-2"
                placeholder="1234-567-890"
              />
              <ErrorText msg={errors.sedulaNumber?.message} />
            </div>
            <div>
              <label className="block text-sm font-medium">{t('labels.primaryPhysician')}</label>
              <input
                type="text"
                {...register('primaryPhysician')}
                className="mt-1 w-full rounded-md border p-2"
              />
              <ErrorText msg={errors.primaryPhysician?.message} />
            </div>
          </div>
        </Section>
      )}

      {/* Medical history */}
      <Section title={t('sections.medical')}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium">{t('labels.lastDentalVisit')}</label>
            <select
              {...register('medical.lastDentalVisit')}
              className="mt-1 w-full rounded-md border p-2"
            >
              <option value="<6m">{t('options.lastDentalVisit.lt6m')}</option>
              <option value="6-12m">{t('options.lastDentalVisit.6to12m')}</option>
              <option value="1-2j">{t('options.lastDentalVisit.1to2y')}</option>
              <option value="2-5j">{t('options.lastDentalVisit.2to5y')}</option>
              <option value=">5j">{t('options.lastDentalVisit.gt5y')}</option>
              <option value="onbekend">{t('options.lastDentalVisit.unknown')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium">{t('labels.brushingFreq')}</label>
            <select
              {...register('medical.brushingFreq')}
              className="mt-1 w-full rounded-md border p-2"
            >
              <option value="1x/dag">{t('options.brushingFreq.1')}</option>
              <option value="2x/dag">{t('options.brushingFreq.2')}</option>
              <option value="≥3x/dag">{t('options.brushingFreq.3')}</option>
              <option value="minder">{t('options.brushingFreq.less')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">{t('labels.flossingFreq')}</label>
            <select
              {...register('medical.flossingFreq')}
              className="mt-1 w-full rounded-md border p-2"
            >
              <option value="dagelijks">{t('options.flossingFreq.daily')}</option>
              <option value="soms">{t('options.flossingFreq.sometimes')}</option>
              <option value="nooit">{t('options.flossingFreq.never')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">{t('labels.dentalAnxiety')}</label>
            <select
              {...register('medical.dentalAnxiety')}
              className="mt-1 w-full rounded-md border p-2"
            >
              <option value="geen">{t('options.dentalAnxiety.none')}</option>
              <option value="mild">{t('options.dentalAnxiety.mild')}</option>
              <option value="matig">{t('options.dentalAnxiety.moderate')}</option>
              <option value="ernstig">{t('options.dentalAnxiety.severe')}</option>
            </select>
          </div>

          {/* Medications */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium">{t('labels.medications')}</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                [
                  'geen',
                  'bloedverdunners',
                  'diabetesmedicatie',
                  'antihypertensiva',
                  'antidepressiva',
                  'anders',
                ] as const
              ).map((opt) => {
                const isOn = medsSelected.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={isOn}
                      onChange={() => toggleArray('medical.medicationsSelected', opt)}
                    />
                    <span className="select-none">{t(`options.medications.${opt}`)}</span>
                  </label>
                );
              })}
            </div>
            <ErrorText msg={getErrMsg(errors.medical?.medicationsSelected)} />
          </div>

          {/* Medication details (shown when applicable) */}
          {medsSelected.includes('bloedverdunners') && (
            <div className="md:col-span-3">
              <label className="block text-sm font-medium">{t('labels.med_bloedverdunners')}</label>
              <input
                type="text"
                {...register('medical.medicationDetails.bloedverdunners')}
                className="mt-1 w-full rounded-md border p-2"
                placeholder={t('placeholders.med_bloedverdunners')}
              />
              <ErrorText msg={getErrMsg(errors.medical?.medicationDetails?.bloedverdunners)} />
            </div>
          )}
          {medsSelected.includes('diabetesmedicatie') && (
            <div className="md:col-span-3">
              <label className="block text-sm font-medium">{t('labels.med_diabetes')}</label>
              <input
                type="text"
                {...register('medical.medicationDetails.diabetesmedicatie')}
                className="mt-1 w-full rounded-md border p-2"
                placeholder={t('placeholders.med_diabetes')}
              />
              <ErrorText msg={getErrMsg(errors.medical?.medicationDetails?.diabetesmedicatie)} />
            </div>
          )}
          {medsSelected.includes('anders') && (
            <div className="md:col-span-3">
              <label className="block text-sm font-medium">{t('labels.med_other')}</label>
              <input
                type="text"
                {...register('medical.medicationDetails.anders')}
                className="mt-1 w-full rounded-md border p-2"
                placeholder={t('placeholders.med_other')}
              />
              <ErrorText msg={getErrMsg(errors.medical?.medicationDetails?.anders)} />
            </div>
          )}

          {/* Allergies */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium">{t('labels.allergies')}</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(
                ['geen', 'penicilline', 'lokale_verdoving', 'latex', 'nikkel', 'anders'] as const
              ).map((opt) => {
                const isOn = allergiesSelected.includes(opt);
                return (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={isOn}
                      onChange={() => toggleArray('medical.allergiesSelected', opt)}
                    />
                    <span className="select-none">{t(`options.allergies.${opt}`)}</span>
                  </label>
                );
              })}
            </div>
            <ErrorText msg={getErrMsg(errors.medical?.allergiesSelected)} />
          </div>

          {allergiesSelected.includes('anders') && (
            <div className="md:col-span-3">
              <label className="block text-sm font-medium">{t('labels.allergy_other')}</label>
              <input
                type="text"
                {...register('medical.allergyDetails.anders')}
                className="mt-1 w-full rounded-md border p-2"
              />
              <ErrorText msg={getErrMsg(errors.medical?.allergyDetails?.anders)} />
            </div>
          )}

          {/* Conditions */}
          <div className="md:col-span-3">
            <label className="block text-sm font-medium">{t('labels.conditions')}</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {conditionEntries.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox {...register(`medical.conditions.${key}` as const)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">{t('labels.complicationsBefore')}</label>
            <select
              {...register('medical.complicationsBefore')}
              className="mt-1 w-full rounded-md border p-2"
            >
              <option value="nee">{t('options.no')}</option>
              <option value="ja">{t('options.yes')}</option>
            </select>
            <ErrorText msg={errors.medical?.complicationsBefore?.message} />
          </div>

          {complicationsBefore === 'ja' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium">
                {t('labels.complicationsDetails')}
              </label>
              <input
                type="text"
                {...register('medical.complicationsDetails')}
                className="mt-1 w-full rounded-md border p-2"
              />
              <ErrorText msg={errors.medical?.complicationsDetails?.message} />
            </div>
          )}
        </div>
      </Section>

      {/* Consents */}
      <Section title={t('sections.consents')}>
        <label className="flex items-start gap-3">
          <Checkbox {...register('marketingConsent')} className="mt-1" />
          <span className="text-sm">{t('labels.marketingConsent')}</span>
        </label>

        <label className="flex items-start gap-3">
          <Checkbox {...register('privacyConsent')} className="mt-1" />
          <span className="text-sm">
            {t('labels.privacyConsent')}{' '}
            <button
              type="button"
              className="underline"
              onClick={(e) => {
                // Prevent toggling the checkbox and avoid page jump to top
                e.stopPropagation();
                // TODO: open privacy policy modal or navigate to a policy page
              }}
            >
              {t('labels.privacyPolicy')}
            </button>
            .
          </span>
        </label>
        <ErrorText msg={errors.privacyConsent?.message} />
      </Section>

      <Button type="submit" disabled={submitting} className="mt-2">
        {submitting ? t('buttons.submitting') : t('buttons.submit')}
      </Button>
    </form>
  );
}

// Expose hCaptcha callback to window
declare global {
  interface Window {
    onHCaptchaVerify?: (token: string) => void;
  }
}

if (typeof window !== 'undefined') {
  window.onHCaptchaVerify = (token: string) => {
    try {
      const event = new CustomEvent('hcaptcha-verified', { detail: token });
      window.dispatchEvent(event);
    } catch {}
  };
}

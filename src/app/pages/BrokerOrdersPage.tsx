import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Camera,
  Clock3,
  Copy,
  ExternalLink,
  FileSignature,
  Link2,
  Mail,
  MapPin,
  Send,
  Upload,
  UserRound,
} from 'lucide-react';
import {
  ApiBillingOverview,
  ApiBuyerIndication,
  ApiClient,
  ApiDocumentTemplate,
  ApiError,
  ApiPropertyBlacklistEntry,
  ApiProcessTemplateTeamAssignment,
  ApiProcessTemplate,
  ApiProperty,
  ApiSellerListingAssignmentDocument,
  ApiSellerListingAssignment,
  approveBuyerIndication,
  approveSellerListingAssignment,
  attachSellerListingAssignmentPhoto,
  bookBuyerIndicationAppointment,
  createBuyerIndication,
  createDeal,
  createSellerListingAssignment,
  createSellerListingAssignmentPhotoUploadUrl,
  downloadBuyerIndicationDocument,
  downloadSellerListingAssignmentDocument,
  getBillingOverview,
  getBuyerIndication,
  getSellerListingAssignment,
  importSellerListingAssignmentProperty,
  listPropertyBlacklist,
  listBuyerIndications,
  listClients,
  listDocumentTemplates,
  listProcessTemplateTeamAssignments,
  listProcessTemplates,
  listProperties,
  listSellerListingAssignments,
  resendBuyerIndication,
  resendSellerListingAssignment,
  reviewSellerListingAssignmentDocument,
  saveSellerListingAssignmentImportDraft,
  isMockUploadUrl,
} from '../api/trustlayerApi';
import { GooglePlaceLookupPanel } from '../components/GooglePlaceLookupPanel';
import { SignaturePad } from '../components/SignaturePad';
import { Calendar as UiCalendar } from '../components/ui/calendar';
import { useUiStore } from '../state/uiStore';

type BrokerIdentityMode = 'self' | 'office';
type BrokerGender = 'male' | 'female';
type SellerBuilderStep = 'seller' | 'media' | 'publish';
const SELLER_BUILDER_STEP_ORDER: SellerBuilderStep[] = ['seller', 'media', 'publish'];

function sellerStatusLabel(status: ApiSellerListingAssignment['status']) {
  switch (status) {
    case 'SENT':
      return 'Στάλθηκε';
    case 'EXPIRED':
      return 'Έληξε';
    case 'RENEWAL_REQUESTED':
      return 'Ζητήθηκε νέο link';
    case 'BROKER_REVIEW':
      return 'Σε έλεγχο μεσίτη';
    case 'APPROVED':
      return 'Εγκρίθηκε';
    case 'IMPORTED':
      return 'Εισήχθη';
    default:
      return status;
  }
}

function buyerStatusLabel(status: ApiBuyerIndication['status']) {
  switch (status) {
    case 'SENT':
      return 'Στάλθηκε';
    case 'EXPIRED':
      return 'Έληξε';
    case 'RENEWAL_REQUESTED':
      return 'Ζητήθηκε νέο link';
    case 'BROKER_REVIEW':
      return 'Σε έλεγχο μεσίτη';
    case 'APPROVED':
      return 'Εγκρίθηκε';
    case 'APPOINTMENT_BOOKED':
      return 'Κλείστηκε ραντεβού';
    case 'FOLLOW_UP_PENDING':
      return 'Αναμένει ενδιαφέρον';
    case 'INTERESTED':
      return 'Ενδιαφέρεται';
    case 'NOT_INTERESTED':
      return 'Δεν ενδιαφέρεται';
    default:
      return status;
  }
}

function sellerSupportingDocumentStatusLabel(status: ApiSellerListingAssignmentDocument['status']) {
  switch (status) {
    case 'PENDING':
      return 'Σε αναμονή';
    case 'UPLOADED':
      return 'Ανέβηκε - προς έλεγχο';
    case 'APPROVED':
      return 'Εγκρίθηκε';
    case 'REJECTED':
      return 'Απορρίφθηκε';
    default:
      return status;
  }
}

function statusTone(status: string) {
  if (status === 'APPROVED' || status === 'IMPORTED') {
    return 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]';
  }
  if (status === 'INTERESTED') {
    return 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]';
  }
  if (status === 'EXPIRED') {
    return 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]';
  }
  if (status === 'BROKER_REVIEW' || status === 'RENEWAL_REQUESTED' || status === 'FOLLOW_UP_PENDING') {
    return 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]';
  }
  return 'border-[var(--border-default)] bg-[var(--surface-highlight)] text-[var(--text-secondary)]';
}

function renderInlineField(label: string, value: string | number | null | undefined, widthClass: string) {
  return (
    <div className="flex min-w-0 items-baseline gap-2" key={label}>
      <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.08em] text-[#111827]">{label}</p>
      <p className={`min-w-0 border-b border-[#111827] px-1 pb-0.5 ${widthClass}`}>{value ?? ''}</p>
    </div>
  );
}

function BuyerIndicationDocumentPreview({ indication }: { indication: ApiBuyerIndication }) {
  const buyerGenderMarker = indication.buyerGender === 'FEMALE' ? 'Η' : 'Ο';
  const buyerSigningLabel = indication.buyerGender === 'FEMALE' ? 'Η ΥΠΟΓΡΑΦΟΥΣΑ' : 'Ο ΥΠΟΓΡΑΦΩΝ';
  const brokerSubject =
    indication.brokerIdentityMode === 'OFFICE'
      ? `Το μεσιτικό γραφείο ${indication.brokerOffice}`
      : indication.brokerGender === 'FEMALE'
        ? `Η μεσίτρια ${indication.brokerName}`
        : `Ο μεσίτης ${indication.brokerName}`;
  const actingLine =
    indication.actingMode === 'REPRESENTING_OTHER' && indication.actingOnBehalfOf
      ? `\nΕΝΕΡΓΩΝ ΚΑΤΟΠΙΝ ΕΝΤΟΛΗΣ ΤΟΥ/ΤΩΝ ${indication.actingOnBehalfOf}`
      : '\nΕΝΕΡΓΩΝ ΑΤΟΜΙΚΑ';

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-white p-6 text-sm text-[#111827] shadow-sm">
      <h4 className="text-center text-xl font-semibold">ΕΝΤΟΛΗ ΥΠΟΔΕΙΞΗΣ ΑΚΙΝΗΤΟΥ</h4>
      <div className="mt-6 grid gap-4 leading-6">
        {renderInlineField(buyerSigningLabel, indication.buyerFullName, 'min-w-[24rem]')}
      </div>
      <div className="mt-4 grid gap-4 leading-6 md:grid-cols-2">
        {renderInlineField('ΠΑΤΡΩΝΥΜΟ', indication.buyerFatherName, 'min-w-[14rem]')}
        {renderInlineField('ΓΕΝΟΣ', buyerGenderMarker, 'min-w-[5rem]')}
        {renderInlineField('Α.Φ.Μ.', indication.buyerTaxId, 'min-w-[12rem]')}
        {renderInlineField('ΚΑΤΟΙΚΟΣ', indication.buyerCity, 'min-w-[16rem]')}
      </div>
      <div className="mt-4 grid gap-4 leading-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(0,1.1fr)]">
        {renderInlineField('ΟΔΟΣ', indication.buyerStreet, 'min-w-[10rem]')}
        {renderInlineField('ΑΡΙΘ.', indication.buyerStreetNumber, 'min-w-[4rem]')}
        {renderInlineField('ΤΗΛ.', indication.buyerPhone, 'min-w-[10rem]')}
      </div>
      <div className="mt-4 grid gap-4 leading-6">
        {renderInlineField('Α.Δ.Τ.', indication.buyerIdNumber, 'min-w-[12rem]')}
      </div>
      <div className="mt-4 grid gap-4 leading-6 md:grid-cols-2">
        <p className="whitespace-pre-line md:col-span-2">{actingLine}</p>
        <p className="pt-2 md:col-span-2">
          {brokerSubject} μπορεί να μου υποδείξει το κατωτέρω ακίνητο προς αγορά / μίσθωση / αντιπαροχή και ότι η παρούσα υπόδειξη αποτελεί την πρώτη γνωστοποίησή του σε εμένα.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="bg-[#eeeeee] text-xs font-semibold uppercase tracking-wide text-[#374151]">
              {['ΠΕΡΙΟΧΗ', 'ΔΙΕΥΘΥΝΣΗ', 'ΕΙΔΟΣ', 'Τ.Μ.', 'ΑΞΙΑ', 'ΑΜΟΙΒΗ Σ.Ε.'].map((label) => (
                <th key={label} className="border border-[#7a7a7a] px-3 py-2 text-center">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className="border border-[#7a7a7a] px-3 py-3">{indication.propertyRegion}</td>
              <td className="border border-[#7a7a7a] px-3 py-3">{indication.propertyAddress}</td>
              <td className="border border-[#7a7a7a] px-3 py-3">{indication.propertyType}</td>
              <td className="border border-[#7a7a7a] px-3 py-3">{indication.propertyArea ?? ''}</td>
              <td className="border border-[#7a7a7a] px-3 py-3">{Number(indication.propertyValue).toLocaleString('el-GR')} €</td>
              <td className="border border-[#7a7a7a] px-3 py-3">{Number(indication.grossFeeWithVat).toLocaleString('el-GR')} €</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-6 leading-6">
        Η μεσιτική αμοιβή συμφωνείται σε ποσοστό {indication.brokerCommissionPct}% συν του πλέον νόμιμου Φ.Π.Α., καταβλητέο με την υπογραφή του οριστικού συμβολαίου / μισθωτηρίου / ιδιωτικού συμφωνητικού.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="font-semibold">Ο ΕΝΤΟΛΕΑΣ / ΣΥΝΑΙΝΩΝ</p>
          <p className="mt-3">{indication.buyerFullName || ''}</p>
        </div>
        <div>
          <p className="font-semibold">{indication.fixedDocumentCity}</p>
          <p className="mt-3">{(indication.approvedAt ?? indication.submittedAt ?? '').slice(0, 10)}</p>
        </div>
        <div>
          <p className="font-semibold">Ο ΜΕΣΙΤΗΣ</p>
          <p className="mt-3">{indication.brokerName}</p>
        </div>
      </div>
    </div>
  );
}

function SellerListingAssignmentDocumentPreview({ assignment }: { assignment: ApiSellerListingAssignment }) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-white p-6 text-sm text-[#111827] shadow-sm">
      <h4 className="text-center text-xl font-semibold">ΕΝΤΟΛΗ ΠΑΡΑΧΩΡΗΣΗΣ ΑΚΙΝΗΤΟΥ</h4>
      <div className="mt-6 whitespace-pre-line leading-7">
        {assignment.generatedDocumentText || 'Δεν έχουν συμπληρωθεί ακόμη τα απαιτούμενα στοιχεία για το παραγόμενο έγγραφο.'}
      </div>
    </div>
  );
}

async function downloadGeneratedIndicationDocument(indication: ApiBuyerIndication) {
  const blob = await downloadBuyerIndicationDocument(indication.id);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `entoli-ypodeixis-${indication.id}.docx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadGeneratedSellerAssignmentDocument(assignment: ApiSellerListingAssignment) {
  const blob = await downloadSellerListingAssignmentDocument(assignment.id);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `entoli-paraxorisis-${assignment.id}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

type SellerImportForm = {
  title: string;
  location: string;
  price: string;
  type: string;
  kaek: string;
  googlePlaceId: string;
  latitude: string;
  longitude: string;
  googleMapsUrl: string;
  listingUrl: string;
  referenceListingCode: string;
  listingCodes: string;
  description: string;
  tags: string;
  sellerRejectsLoanBuyers: boolean;
};

type BrokerAppointmentEntry = {
  id: string;
  propertyTitle: string;
  propertyReferenceListingCode?: string;
  buyerEmail: string;
  appointmentBrokerName?: string;
  startAt: Date;
  endAt: Date;
  dayKey: string;
};

const initialSellerImportForm: SellerImportForm = {
  title: '',
  location: '',
  price: '',
  type: '',
  kaek: '',
  googlePlaceId: '',
  latitude: '',
  longitude: '',
  googleMapsUrl: '',
  listingUrl: '',
  referenceListingCode: '',
  listingCodes: '',
  description: '',
  tags: '',
  sellerRejectsLoanBuyers: false,
};

function formatCalendarDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalDateInputValue(iso?: string) {
  if (!iso) {
    return '';
  }
  return formatCalendarDayKey(new Date(iso));
}

function toLocalTimeInputValue(iso?: string) {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function combineLocalDateAndTime(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${timeValue}:00`);
}

function parseCommaSeparatedValues(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isSellerBuilderStep(value: string | undefined): value is SellerBuilderStep {
  return value === 'seller' || value === 'media' || value === 'publish';
}

function propertyRejectsLoanBuyers(property: ApiProperty | undefined) {
  const tags = property?.tags ?? [];
  return tags.some((tag) => {
    const normalized = tag.trim().toLowerCase();
    return normalized === 'seller_no_loan'
      || normalized === 'seller-no-loan'
      || normalized === 'no-loan'
      || normalized === 'χωρις δανειο'
      || normalized === 'χωρίς δάνειο';
  });
}

function clientUsesLoan(client: ApiClient | undefined) {
  if (!client) return false;
  const tags = client.tags ?? [];
  if (tags.some((tag) => {
    const normalized = tag.trim().toLowerCase();
    return normalized === 'buyer_loan'
      || normalized === 'loan'
      || normalized === 'mortgage'
      || normalized === 'δανειο'
      || normalized === 'δάνειο';
  })) {
    return true;
  }
  const metadataCandidates = [
    client.leadMetadata?.buyer_loan,
    client.leadMetadata?.offer_case,
    client.leadMetadata?.loan,
    client.leadMetadata?.financing,
  ];
  return metadataCandidates.some((value) => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === 'true'
      || normalized === 'yes'
      || normalized === 'loan'
      || normalized === 'mortgage'
      || normalized === 'buyer_loan'
      || normalized === 'με δάνειο'
      || normalized === 'δανειο'
      || normalized === 'δάνειο';
  });
}

function findMatchingProcessTemplateId(
  documentTemplateId: string,
  documentTemplates: ApiDocumentTemplate[],
  processTemplates: ApiProcessTemplate[],
) {
  const selectedDocumentTemplate = documentTemplates.find((template) => template.id === documentTemplateId);
  if (!selectedDocumentTemplate?.type) {
    return '';
  }
  return processTemplates.find((template) => template.type === selectedDocumentTemplate.type)?.id ?? '';
}

function findMatchingDocumentTemplateId(
  processTemplateId: string,
  documentTemplates: ApiDocumentTemplate[],
  processTemplates: ApiProcessTemplate[],
) {
  const selectedProcessTemplate = processTemplates.find((template) => template.id === processTemplateId);
  if (!selectedProcessTemplate?.type) {
    return '';
  }
  return documentTemplates.find((template) => template.type === selectedProcessTemplate.type)?.id ?? '';
}

export function BrokerOrdersPage() {
  const { showToast } = useUiStore();
  const [buyerIndications, setBuyerIndications] = useState<ApiBuyerIndication[]>([]);
  const [sellerAssignments, setSellerAssignments] = useState<ApiSellerListingAssignment[]>([]);
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [properties, setProperties] = useState<ApiProperty[]>([]);
  const [propertyBlacklist, setPropertyBlacklist] = useState<ApiPropertyBlacklistEntry[]>([]);
  const [documentTemplates, setDocumentTemplates] = useState<ApiDocumentTemplate[]>([]);
  const [processTemplates, setProcessTemplates] = useState<ApiProcessTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingOverview, setBillingOverview] = useState<ApiBillingOverview | null>(null);

  const [createIndicationModalOpen, setCreateIndicationModalOpen] = useState(false);
  const [reviewIndicationModalOpen, setReviewIndicationModalOpen] = useState(false);
  const [appointmentCalendarModalOpen, setAppointmentCalendarModalOpen] = useState(false);
  const [createDealModalOpen, setCreateDealModalOpen] = useState(false);
  const [sellerAssignmentModalOpen, setSellerAssignmentModalOpen] = useState(false);
  const [reviewSellerAssignmentModalOpen, setReviewSellerAssignmentModalOpen] = useState(false);
  const [sellerImportBuilderOpen, setSellerImportBuilderOpen] = useState(false);

  const [selectedBuyerIndication, setSelectedBuyerIndication] = useState<ApiBuyerIndication | null>(null);
  const [selectedSellerAssignment, setSelectedSellerAssignment] = useState<ApiSellerListingAssignment | null>(null);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedDocTemplateId, setSelectedDocTemplateId] = useState('');
  const [selectedProcessTemplateId, setSelectedProcessTemplateId] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [processTemplateTeamAssignments, setProcessTemplateTeamAssignments] = useState<ApiProcessTemplateTeamAssignment[]>([]);
  const [loadingProcessTemplateTeams, setLoadingProcessTemplateTeams] = useState(false);

  const [indicationBuyerEmail, setIndicationBuyerEmail] = useState('');
  const [indicationExpiryDays, setIndicationExpiryDays] = useState(7);
  const [indicationBrokerName, setIndicationBrokerName] = useState('');
  const [indicationBrokerOffice, setIndicationBrokerOffice] = useState('');
  const [indicationBrokerIdentityMode, setIndicationBrokerIdentityMode] = useState<BrokerIdentityMode>('self');
  const [indicationBrokerGender, setIndicationBrokerGender] = useState<BrokerGender>('male');
  const [indicationCommissionPct, setIndicationCommissionPct] = useState('2');
  const [indicationPropertyArea, setIndicationPropertyArea] = useState('');
  const [brokerSignature, setBrokerSignature] = useState('');
  const [appointmentStartAt, setAppointmentStartAt] = useState('');
  const [appointmentEndAt, setAppointmentEndAt] = useState('');
  const [appointmentBrokerName, setAppointmentBrokerName] = useState('');
  const [appointmentDateValue, setAppointmentDateValue] = useState('');
  const [appointmentStartTime, setAppointmentStartTime] = useState('');
  const [appointmentEndTime, setAppointmentEndTime] = useState('');

  const [sellerEmail, setSellerEmail] = useState('');
  const [sellerCommissionPct, setSellerCommissionPct] = useState('2');
  const [sellerExpiryDays, setSellerExpiryDays] = useState(7);
  const [sellerReviewComment, setSellerReviewComment] = useState('');
  const [sellerBrokerSignature, setSellerBrokerSignature] = useState('');
  const [sellerBuilderStep, setSellerBuilderStep] = useState<SellerBuilderStep>('seller');
  const [sellerImportForm, setSellerImportForm] = useState<SellerImportForm>(initialSellerImportForm);
  const [sellerPlaceLookupQuery, setSellerPlaceLookupQuery] = useState('');

  const [isCreatingIndication, setIsCreatingIndication] = useState(false);
  const [isApprovingIndication, setIsApprovingIndication] = useState(false);
  const [isBookingIndicationAppointment, setIsBookingIndicationAppointment] = useState(false);
  const [isResendingIndication, setIsResendingIndication] = useState(false);
  const [isCreatingDeal, setIsCreatingDeal] = useState(false);
  const [creatingSellerAssignment, setCreatingSellerAssignment] = useState(false);
  const [isApprovingSellerAssignment, setIsApprovingSellerAssignment] = useState(false);
  const [isResendingSellerAssignment, setIsResendingSellerAssignment] = useState(false);
  const [isUploadingSellerPhoto, setIsUploadingSellerPhoto] = useState(false);
  const [isImportingSellerProperty, setIsImportingSellerProperty] = useState(false);
  const [isSavingSellerDraft, setIsSavingSellerDraft] = useState(false);

  const sellerBuilderSteps: { id: SellerBuilderStep; label: string }[] = useMemo(
    () => [
      { id: 'seller', label: 'Στοιχεία Ακινήτου' },
      { id: 'media', label: 'Φωτογραφίες' },
      { id: 'publish', label: 'Εισαγωγή Συστήματος' },
    ],
    [],
  );
  const integrationsLookupLocked = billingOverview ? !billingOverview.integrationsEnabled : false;

  const blacklistedPropertyIds = useMemo(() => {
    const kaekSet = new Set(
      propertyBlacklist
        .filter((entry) => entry.identityType === 'KAEK')
        .map((entry) => entry.identityValue.trim().toLowerCase()),
    );
    const placeIdSet = new Set(
      propertyBlacklist
        .filter((entry) => entry.identityType === 'GOOGLE_PLACE_ID')
        .map((entry) => entry.identityValue.trim().toLowerCase()),
    );
    const internalCodeSet = new Set(
      propertyBlacklist
        .filter((entry) => entry.identityType === 'INTERNAL_CODE')
        .map((entry) => entry.identityValue.trim().toLowerCase()),
    );

    return new Set(
      properties
        .filter((property) => {
          const kaek = property.kaek?.trim().toLowerCase();
          const placeId = property.googlePlaceId?.trim().toLowerCase();
          const listingCodes = Array.from(new Set([
            ...(property.referenceListingCode ? [property.referenceListingCode] : []),
            ...(property.listingCodes ?? []),
          ].map((code) => code.trim().toLowerCase())));
          return Boolean(
            (kaek && kaekSet.has(kaek))
            || (placeId && placeIdSet.has(placeId))
            || listingCodes.some((code) => internalCodeSet.has(code)),
          );
        })
        .map((property) => property.id),
    );
  }, [properties, propertyBlacklist]);

  const brokerAppointments = useMemo<BrokerAppointmentEntry[]>(
    () => buyerIndications
      .filter((item) => item.appointmentStartAt && item.appointmentEndAt)
      .map((item) => {
        const startAt = new Date(item.appointmentStartAt as string);
        const endAt = new Date(item.appointmentEndAt as string);
        return {
          id: item.id,
          propertyTitle: item.propertyTitle,
          propertyReferenceListingCode: item.propertyReferenceListingCode,
          buyerEmail: item.buyerEmail,
          appointmentBrokerName: item.appointmentBrokerName,
          startAt,
          endAt,
          dayKey: formatCalendarDayKey(startAt),
        };
      })
      .filter((item) => !Number.isNaN(item.startAt.getTime()) && !Number.isNaN(item.endAt.getTime())),
    [buyerIndications],
  );

  const appointmentCountsByDay = useMemo(() => {
    const counts = new Map<string, number>();
    brokerAppointments.forEach((appointment) => {
      counts.set(appointment.dayKey, (counts.get(appointment.dayKey) ?? 0) + 1);
    });
    return counts;
  }, [brokerAppointments]);

  const selectedAppointmentDate = useMemo(() => {
    if (!appointmentDateValue) {
      return undefined;
    }
    const selected = new Date(`${appointmentDateValue}T12:00:00`);
    return Number.isNaN(selected.getTime()) ? undefined : selected;
  }, [appointmentDateValue]);

  const selectedDayAppointments = useMemo(
    () => brokerAppointments
      .filter((appointment) => appointment.dayKey === appointmentDateValue && appointment.id !== selectedBuyerIndication?.id)
      .sort((left, right) => left.startAt.getTime() - right.startAt.getTime()),
    [appointmentDateValue, brokerAppointments, selectedBuyerIndication],
  );

  const reload = async () => {
    setLoading(true);
    try {
      const [buyers, sellers, nextClients, nextProperties, blacklistEntries, nextDocTemplates, nextProcessTemplates, overview] = await Promise.all([
        listBuyerIndications(),
        listSellerListingAssignments(),
        listClients(),
        listProperties(),
        listPropertyBlacklist(),
        listDocumentTemplates(),
        listProcessTemplates(),
        getBillingOverview(),
      ]);
      setBuyerIndications(buyers);
      setSellerAssignments(sellers);
      setClients(nextClients);
      setProperties(nextProperties);
      setPropertyBlacklist(blacklistEntries);
      setDocumentTemplates(nextDocTemplates);
      setProcessTemplates(nextProcessTemplates);
      setBillingOverview(overview);

      if (nextClients.length > 0) {
        setSelectedClientId((prev) => prev || nextClients[0].id);
      }
      const nextDocTemplateId = selectedDocTemplateId
        || findMatchingDocumentTemplateId(selectedProcessTemplateId, nextDocTemplates, nextProcessTemplates)
        || nextDocTemplates[0]?.id
        || '';
      const nextProcessTemplateId = selectedProcessTemplateId
        || findMatchingProcessTemplateId(nextDocTemplateId, nextDocTemplates, nextProcessTemplates)
        || nextProcessTemplates[0]?.id
        || '';
      setSelectedDocTemplateId(nextDocTemplateId);
      setSelectedProcessTemplateId(nextProcessTemplateId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία φόρτωσης εντολών.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!selectedProcessTemplateId) {
      setProcessTemplateTeamAssignments([]);
      setSelectedTeamIds([]);
      return;
    }

    let cancelled = false;
    setLoadingProcessTemplateTeams(true);
    listProcessTemplateTeamAssignments(selectedProcessTemplateId)
      .then((rows) => {
        if (cancelled) return;
        setProcessTemplateTeamAssignments(rows);
        const allowedTeamIds = new Set(rows.map((row) => row.teamId));
        setSelectedTeamIds((prev) => prev.filter((teamId) => allowedTeamIds.has(teamId)));
      })
      .catch(() => {
        if (cancelled) return;
        setProcessTemplateTeamAssignments([]);
        setSelectedTeamIds([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProcessTemplateTeams(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProcessTemplateId]);

  const stats = useMemo(
    () => ({
      buyerTotal: buyerIndications.length,
      sellerTotal: sellerAssignments.length,
      sellerPending: sellerAssignments.filter((item) => item.status === 'SENT' || item.status === 'BROKER_REVIEW').length,
      sellerImported: sellerAssignments.filter((item) => item.status === 'IMPORTED').length,
    }),
    [buyerIndications, sellerAssignments],
  );

  const compatibleTeams = useMemo(() => {
    const teamMap = new Map<string, { id: string; name: string; slots: string[] }>();
    for (const assignment of processTemplateTeamAssignments) {
      const slotParts = [assignment.professionalRoleName ?? assignment.role];
      if (assignment.partyRole === 'BUYER') slotParts.push('Αγοραστής');
      if (assignment.partyRole === 'SELLER') slotParts.push('Πωλητής');
      const slotLabel = slotParts.join(' • ');
      const existing = teamMap.get(assignment.teamId);
      if (existing) {
        if (!existing.slots.includes(slotLabel)) {
          existing.slots.push(slotLabel);
        }
        continue;
      }
      teamMap.set(assignment.teamId, {
        id: assignment.teamId,
        name: assignment.teamName,
        slots: [slotLabel],
      });
    }
    return Array.from(teamMap.values());
  }, [processTemplateTeamAssignments]);

  const indicationMatchedClient = useMemo(
    () => clients.find((client) => client.email?.trim().toLowerCase() === indicationBuyerEmail.trim().toLowerCase()),
    [clients, indicationBuyerEmail],
  );
  const indicationSelectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId),
    [properties, selectedPropertyId],
  );
  const indicationLoanRestricted =
    propertyRejectsLoanBuyers(indicationSelectedProperty) && clientUsesLoan(indicationMatchedClient);

  const syncSellerImportForm = (assignment: ApiSellerListingAssignment) => {
    const hasDraft =
      Boolean(assignment.importDraftTitle)
      || Boolean(assignment.importDraftLocation)
      || Boolean(assignment.importDraftType)
      || assignment.importDraftPrice != null
      || Boolean(assignment.importDraftListingUrl)
      || Boolean(assignment.importDraftReferenceListingCode)
      || Boolean(assignment.importDraftDescription)
      || Boolean(assignment.importDraftSellerRejectsLoanBuyers)
      || Boolean(assignment.importDraftStep)
      || Boolean(assignment.importDraftListingCodes?.length)
      || Boolean(assignment.importDraftTags?.length);
    setSellerImportForm({
      title: hasDraft ? assignment.importDraftTitle ?? '' : assignment.propertyTitle ?? '',
      location: hasDraft ? assignment.importDraftLocation ?? '' : assignment.propertyLocation ?? '',
      price: hasDraft
        ? assignment.importDraftPrice != null ? String(assignment.importDraftPrice) : ''
        : assignment.propertyPrice != null ? String(assignment.propertyPrice) : '',
      type: hasDraft ? assignment.importDraftType ?? '' : assignment.propertyType ?? '',
      kaek: hasDraft ? assignment.importDraftKaek ?? '' : '',
      googlePlaceId: hasDraft ? assignment.importDraftGooglePlaceId ?? '' : '',
      latitude: hasDraft && assignment.importDraftLatitude != null ? String(assignment.importDraftLatitude) : '',
      longitude: hasDraft && assignment.importDraftLongitude != null ? String(assignment.importDraftLongitude) : '',
      googleMapsUrl: hasDraft ? assignment.importDraftGoogleMapsUrl ?? '' : '',
      listingUrl: hasDraft ? assignment.importDraftListingUrl ?? '' : assignment.listingUrl ?? '',
      referenceListingCode: hasDraft ? assignment.importDraftReferenceListingCode ?? '' : '',
      listingCodes: hasDraft ? (assignment.importDraftListingCodes ?? []).join(', ') : '',
      description: hasDraft ? assignment.importDraftDescription ?? '' : assignment.propertyDescription ?? '',
      tags: hasDraft ? (assignment.importDraftTags ?? []).join(', ') : (assignment.tags ?? []).join(', '),
      sellerRejectsLoanBuyers: hasDraft
        ? Boolean(assignment.importDraftSellerRejectsLoanBuyers)
        : Boolean(assignment.sellerRejectsLoanBuyers),
    });
    setSellerPlaceLookupQuery(
      hasDraft
        ? assignment.importDraftGoogleMapsUrl ?? assignment.importDraftLocation ?? ''
        : assignment.propertyMapsUrl ?? assignment.propertyLocation ?? '',
    );
    setSellerBuilderStep(hasDraft && isSellerBuilderStep(assignment.importDraftStep)
      ? assignment.importDraftStep
      : 'seller');
  };

  const navigateToDealDocuments = (dealId: string) => {
    window.history.pushState({}, '', `/transaction/${dealId}/documents`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const openCreateIndicationModal = () => {
    setSelectedPropertyId('');
    setIndicationBuyerEmail('');
    setCreateIndicationModalOpen(true);
  };

  const sellerAssignmentLink = selectedSellerAssignment
    ? `${window.location.origin}/seller-listing-assignment/${selectedSellerAssignment.publicToken}`
    : '';

  const handleCreateIndication = async () => {
    const selectedProperty = properties.find((property) => property.id === selectedPropertyId);
    if (!selectedProperty || !indicationBuyerEmail.trim()) {
      showToast('Συμπληρώστε ακίνητο και email αγοραστή.', 'warning');
      return;
    }
    if (!indicationBrokerName.trim()) {
      showToast('Συμπληρώστε το ονοματεπώνυμο του μεσίτη.', 'warning');
      return;
    }
    if (indicationBrokerIdentityMode === 'office' && !indicationBrokerOffice.trim()) {
      showToast('Συμπληρώστε το όνομα του μεσιτικού γραφείου.', 'warning');
      return;
    }
    if (indicationLoanRestricted) {
      showToast('Ο πωλητής δεν δέχεται αγοραστές με δάνειο για αυτό το ακίνητο.', 'warning');
      return;
    }

    setIsCreatingIndication(true);
    try {
      const brokerOfficeLabel =
        indicationBrokerIdentityMode === 'self'
          ? indicationBrokerName.trim()
          : indicationBrokerOffice.trim();
      const created = await createBuyerIndication({
        propertyId: selectedProperty.id,
        buyerEmail: indicationBuyerEmail.trim(),
        expiresInDays: indicationExpiryDays,
        brokerName: indicationBrokerName.trim(),
        brokerOffice: brokerOfficeLabel,
        brokerGender: indicationBrokerGender === 'female' ? 'FEMALE' : 'MALE',
        brokerIdentityMode: indicationBrokerIdentityMode === 'office' ? 'OFFICE' : 'SELF',
        brokerCommissionPct: Number(indicationCommissionPct),
        propertyArea: indicationPropertyArea ? Number(indicationPropertyArea) : undefined,
        propertyAddress: selectedProperty.title,
        propertyRegion: selectedProperty.location,
        propertyType: selectedProperty.type,
        propertyValue: Number(selectedProperty.price),
      });
      setBuyerIndications((prev) => [created, ...prev]);
      setSelectedBuyerIndication(created);
      setCreateIndicationModalOpen(false);
      showToast('Η εντολή υπόδειξης στάλθηκε στον αγοραστή.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία αποστολής εντολής υπόδειξης.', 'error');
    } finally {
      setIsCreatingIndication(false);
    }
  };

  const syncAppointmentForm = (indication: ApiBuyerIndication) => {
    const startAt = indication.appointmentStartAt ? new Date(indication.appointmentStartAt) : null;
    const endAt = indication.appointmentEndAt ? new Date(indication.appointmentEndAt) : null;
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    const nextDateValue = startAt && !Number.isNaN(startAt.getTime())
      ? formatCalendarDayKey(startAt)
      : formatCalendarDayKey(defaultDate);
    setAppointmentDateValue(nextDateValue);
    setAppointmentStartTime(startAt && !Number.isNaN(startAt.getTime()) ? toLocalTimeInputValue(indication.appointmentStartAt) : '10:00');
    setAppointmentEndTime(endAt && !Number.isNaN(endAt.getTime()) ? toLocalTimeInputValue(indication.appointmentEndAt) : '11:00');
    setAppointmentStartAt(indication.appointmentStartAt ? indication.appointmentStartAt.slice(0, 16) : '');
    setAppointmentEndAt(indication.appointmentEndAt ? indication.appointmentEndAt.slice(0, 16) : '');
    setAppointmentBrokerName(indication.appointmentBrokerName ?? indication.brokerName ?? '');
  };

  const openAppointmentCalendar = (indication: ApiBuyerIndication) => {
    setSelectedBuyerIndication(indication);
    syncAppointmentForm(indication);
    setAppointmentCalendarModalOpen(true);
  };

  const openIndicationReview = async (indicationId: string) => {
    try {
      const indication = await getBuyerIndication(indicationId);
      setSelectedBuyerIndication(indication);
      setSelectedClientId(indication.clientId ?? '');
      setSelectedPropertyId(indication.propertyId);
      setBrokerSignature(indication.brokerSignature ?? '');
      syncAppointmentForm(indication);
      setReviewIndicationModalOpen(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία φόρτωσης εντολής υπόδειξης.', 'error');
    }
  };

  const handleApproveIndication = async () => {
    if (!selectedBuyerIndication || !brokerSignature) {
      showToast('Απαιτείται υπογραφή μεσίτη για την έγκριση.', 'warning');
      return;
    }
    setIsApprovingIndication(true);
    try {
      const approved = await approveBuyerIndication(selectedBuyerIndication.id, { brokerSignature });
      setBuyerIndications((prev) => prev.map((item) => (item.id === approved.id ? approved : item)));
      setSelectedBuyerIndication(approved);
      openAppointmentCalendar(approved);
      showToast('Η εντολή υπόδειξης εγκρίθηκε. Επιλέξτε ημερομηνία και ώρα στο ημερολόγιο ραντεβού.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία έγκρισης της εντολής υπόδειξης.', 'error');
    } finally {
      setIsApprovingIndication(false);
    }
  };

  const handleBookIndicationAppointment = async () => {
    if (!selectedBuyerIndication || !appointmentDateValue || !appointmentStartTime || !appointmentEndTime || !appointmentBrokerName.trim()) {
      showToast('Συμπληρώστε μεσίτη, ώρα έναρξης και ώρα λήξης.', 'warning');
      return;
    }
    const appointmentStart = combineLocalDateAndTime(appointmentDateValue, appointmentStartTime);
    const appointmentEnd = combineLocalDateAndTime(appointmentDateValue, appointmentEndTime);
    if (Number.isNaN(appointmentStart.getTime()) || Number.isNaN(appointmentEnd.getTime())) {
      showToast('Η ημερομηνία ή η ώρα ραντεβού δεν είναι έγκυρη.', 'warning');
      return;
    }
    setIsBookingIndicationAppointment(true);
    try {
      const updated = await bookBuyerIndicationAppointment(selectedBuyerIndication.id, {
        appointmentStartAt: appointmentStart.toISOString(),
        appointmentEndAt: appointmentEnd.toISOString(),
        appointmentBrokerName: appointmentBrokerName.trim(),
      });
      setBuyerIndications((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedBuyerIndication(updated);
      syncAppointmentForm(updated);
      setAppointmentCalendarModalOpen(false);
      showToast('Το ραντεβού υπόδειξης καταχωρήθηκε και στάλθηκε email στον αγοραστή με το πότε και πού.', 'success');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'BUYER_INDICATION_APPOINTMENT_CONFLICT') {
        showToast('Υπάρχει ήδη άλλο ραντεβού του μεσίτη σε εκείνη την ώρα.', 'warning');
      } else {
        showToast(error instanceof Error ? error.message : 'Αποτυχία καταχώρισης ραντεβού.', 'error');
      }
    } finally {
      setIsBookingIndicationAppointment(false);
    }
  };

  const handleResendIndication = async () => {
    if (!selectedBuyerIndication) return;
    setIsResendingIndication(true);
    try {
      const resent = await resendBuyerIndication(selectedBuyerIndication.id, {
        buyerEmail: selectedBuyerIndication.buyerEmail,
        expiresInDays: indicationExpiryDays,
      });
      setBuyerIndications((prev) => prev.map((item) => (item.id === resent.id ? resent : item)));
      setSelectedBuyerIndication(resent);
      showToast('Στάλθηκε νέο link στον αγοραστή.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία αποστολής νέου link.', 'error');
    } finally {
      setIsResendingIndication(false);
    }
  };

  const handleCreateDeal = async () => {
    const selectedTemplate = documentTemplates.find((template) => template.id === selectedDocTemplateId);
    const documentNames = selectedTemplate?.documents
      ?.filter((document) => document.name?.trim())
      .map((document) => document.name.trim());

    if (!selectedClientId || !selectedPropertyId || !selectedDocTemplateId || !selectedProcessTemplateId || !documentNames || documentNames.length === 0) {
      showToast('Ανεπαρκή δεδομένα για δημιουργία συναλλαγής.', 'warning');
      return;
    }
    if (selectedBuyerIndication && !selectedBuyerIndication.dealReady) {
      showToast('Η συναλλαγή επιτρέπεται μόνο αφού ο αγοραστής δηλώσει ενδιαφέρον μετά το ραντεβού.', 'warning');
      return;
    }

    setIsCreatingDeal(true);
    try {
      const createdDeal = await createDeal({
        clientId: selectedClientId,
        propertyId: selectedPropertyId,
        buyerIndicationId: selectedBuyerIndication?.id,
        docTemplateId: selectedDocTemplateId,
        processTemplateId: selectedProcessTemplateId,
        teamIds: selectedTeamIds,
        documents: documentNames,
      });
      setCreateDealModalOpen(false);
      setSelectedBuyerIndication(null);
      showToast('Η νέα συναλλαγή δημιουργήθηκε επιτυχώς.', 'success');
      navigateToDealDocuments(createdDeal.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία δημιουργίας συναλλαγής.', 'error');
    } finally {
      setIsCreatingDeal(false);
    }
  };

  const toggleSelectedTeam = (teamId: string) => {
    setSelectedTeamIds((prev) => (
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    ));
  };

  const handleCreateSellerAssignment = async () => {
    if (!sellerEmail.trim()) {
      showToast('Συμπληρώστε email πωλητή.', 'warning');
      return;
    }

    const commission = Number(sellerCommissionPct);
    if (!Number.isFinite(commission) || commission < 0) {
      showToast('Το ποσοστό αμοιβής πρέπει να είναι έγκυρος αριθμός.', 'warning');
      return;
    }

    if (!Number.isFinite(sellerExpiryDays) || sellerExpiryDays < 1) {
      showToast('Οι ημέρες λήξης πρέπει να είναι τουλάχιστον 1.', 'warning');
      return;
    }

    setCreatingSellerAssignment(true);
    try {
      const created = await createSellerListingAssignment({
        sellerEmail: sellerEmail.trim(),
        expiresInDays: sellerExpiryDays,
        brokerCommissionPct: commission,
      });
      setSellerAssignments((prev) => [created, ...prev]);
      setSelectedSellerAssignment(created);
      syncSellerImportForm(created);
      setSellerAssignmentModalOpen(false);
      setSellerEmail('');
      setSellerCommissionPct('2');
      setSellerExpiryDays(7);
      showToast('Η εντολή παραχώρησης στάλθηκε στον πωλητή.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία δημιουργίας εντολής παραχώρησης.', 'error');
    } finally {
      setCreatingSellerAssignment(false);
    }
  };

  const openSellerAssignmentReview = async (assignmentId: string) => {
    try {
      const assignment = await getSellerListingAssignment(assignmentId);
      setSelectedSellerAssignment(assignment);
      setSellerEmail(assignment.sellerEmail ?? '');
      setSellerCommissionPct(
        assignment.brokerCommissionPct != null ? String(assignment.brokerCommissionPct) : '2',
      );
      setSellerReviewComment('');
      setSellerBrokerSignature(assignment.brokerSignature ?? '');
      syncSellerImportForm(assignment);
      setReviewSellerAssignmentModalOpen(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία φόρτωσης εντολής παραχώρησης.', 'error');
    }
  };

  const handleApproveSellerAssignment = async () => {
    if (!selectedSellerAssignment || !sellerBrokerSignature) {
      showToast('Απαιτείται υπογραφή μεσίτη για την έγκριση.', 'warning');
      return;
    }
    setIsApprovingSellerAssignment(true);
    try {
      const approved = await approveSellerListingAssignment(selectedSellerAssignment.id, {
        reviewComment: sellerReviewComment || undefined,
        brokerSignature: sellerBrokerSignature,
      });
      setSelectedSellerAssignment(approved);
      setSellerAssignments((prev) => prev.map((item) => (item.id === approved.id ? approved : item)));
      syncSellerImportForm(approved);
      setReviewSellerAssignmentModalOpen(false);
      setSellerImportBuilderOpen(true);
      showToast(
        'Η εντολή παραχώρησης εγκρίθηκε και το υπογεγραμμένο έγγραφο στάλθηκε στον ιδιοκτήτη. Προχωρήστε στην εισαγωγή ακινήτου.',
        'success',
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία έγκρισης εντολής παραχώρησης.', 'error');
    } finally {
      setIsApprovingSellerAssignment(false);
    }
  };

  const handleResendSellerAssignment = async () => {
    if (!selectedSellerAssignment) return;
    setIsResendingSellerAssignment(true);
    try {
      const resent = await resendSellerListingAssignment(selectedSellerAssignment.id, {
        sellerEmail: selectedSellerAssignment.sellerEmail,
        expiresInDays: sellerExpiryDays,
        brokerCommissionPct: selectedSellerAssignment.brokerCommissionPct,
      });
      setSelectedSellerAssignment(resent);
      setSellerAssignments((prev) => prev.map((item) => (item.id === resent.id ? resent : item)));
      showToast('Στάλθηκε νέο link στον πωλητή.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία αποστολής νέου link.', 'error');
    } finally {
      setIsResendingSellerAssignment(false);
    }
  };

  const copySellerAssignmentLink = async () => {
    if (!sellerAssignmentLink) return;
    try {
      await navigator.clipboard.writeText(sellerAssignmentLink);
      showToast('Το public link αντιγράφηκε.', 'success');
    } catch {
      showToast('Αποτυχία αντιγραφής link.', 'error');
    }
  };

  const handleBrokerUploadSellerPhoto = async (file: File | null) => {
    if (!selectedSellerAssignment || !file) return;
    setIsUploadingSellerPhoto(true);
    try {
      const { uploadUrl, fileUrl } = await createSellerListingAssignmentPhotoUploadUrl(selectedSellerAssignment.id, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      });
      if (!isMockUploadUrl(uploadUrl)) {
        const response = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!response.ok) {
          throw new Error(`Upload failed (${response.status})`);
        }
      }
      const updated = await attachSellerListingAssignmentPhoto(selectedSellerAssignment.id, { fileUrl });
      setSelectedSellerAssignment(updated);
      setSellerAssignments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      showToast('Η φωτογραφία προστέθηκε στο ακίνητο.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία μεταφόρτωσης φωτογραφίας.', 'error');
    } finally {
      setIsUploadingSellerPhoto(false);
    }
  };

  const handleReviewSellerSupportingDocument = async (
    documentId: string,
    status: 'APPROVED' | 'REJECTED',
  ) => {
    if (!selectedSellerAssignment) return;
    const reviewerComment =
      status === 'REJECTED'
        ? window.prompt('Προαιρετικό σχόλιο απόρριψης για τον πωλητή:', '') || undefined
        : undefined;
    try {
      const updated = await reviewSellerListingAssignmentDocument(selectedSellerAssignment.id, documentId, {
        status,
        reviewerComment,
      });
      setSelectedSellerAssignment(updated);
      setSellerAssignments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      showToast(
        status === 'APPROVED'
          ? 'Το έγγραφο εγκρίθηκε.'
          : 'Το έγγραφο απορρίφθηκε και ο πωλητής θα πρέπει να το ξανανεβάσει.',
        status === 'APPROVED' ? 'success' : 'warning',
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία ελέγχου εγγράφου.', 'error');
    }
  };

  const handleImportSellerProperty = async () => {
    if (!selectedSellerAssignment) return;
    if (!sellerImportForm.title.trim() || !sellerImportForm.location.trim() || !sellerImportForm.type.trim() || !sellerImportForm.price.trim()) {
      showToast('Συμπληρώστε τίτλο, τοποθεσία, τύπο και τιμή για την εισαγωγή.', 'warning');
      return;
    }
    if (
      !sellerImportForm.referenceListingCode.trim()
      && !sellerImportForm.kaek.trim()
      && !sellerImportForm.googlePlaceId.trim()
      && parseCommaSeparatedValues(sellerImportForm.listingCodes).length === 0
    ) {
      showToast('Χρειάζεται τουλάχιστον ένα στοιχείο ταυτοποίησης: KAEK, Google Place ID ή internal ID, ακόμα και παλιός active κωδικός.', 'warning');
      return;
    }

    setIsImportingSellerProperty(true);
    try {
      const property = await importSellerListingAssignmentProperty(selectedSellerAssignment.id, {
        title: sellerImportForm.title.trim(),
        location: sellerImportForm.location.trim(),
        price: Number(sellerImportForm.price),
        type: sellerImportForm.type.trim(),
        kaek: sellerImportForm.kaek.trim() || undefined,
        googleMapsUrl: sellerImportForm.googleMapsUrl.trim() || undefined,
        googlePlaceId: sellerImportForm.googlePlaceId.trim() || undefined,
        latitude: sellerImportForm.latitude.trim() ? Number(sellerImportForm.latitude) : undefined,
        longitude: sellerImportForm.longitude.trim() ? Number(sellerImportForm.longitude) : undefined,
        listingUrl: sellerImportForm.listingUrl || undefined,
        referenceListingCode: sellerImportForm.referenceListingCode.trim() || undefined,
        listingCodes: parseCommaSeparatedValues(sellerImportForm.listingCodes),
        description: sellerImportForm.description || undefined,
        photos: selectedSellerAssignment.photoUrls ?? [],
        tags: parseCommaSeparatedValues(sellerImportForm.tags),
        sellerRejectsLoanBuyers: sellerImportForm.sellerRejectsLoanBuyers,
      });
      const refreshed = await getSellerListingAssignment(selectedSellerAssignment.id);
      setSelectedSellerAssignment(refreshed);
      setSellerAssignments((prev) => prev.map((item) => (item.id === refreshed.id ? refreshed : item)));
      setProperties((prev) => [property, ...prev]);
      setSellerImportBuilderOpen(false);
      setReviewSellerAssignmentModalOpen(false);
      showToast('Το ακίνητο εισήχθη στο σύστημα επιτυχώς.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία εισαγωγής ακινήτου.', 'error');
    } finally {
      setIsImportingSellerProperty(false);
    }
  };

  const handleSaveSellerImportDraft = async () => {
    if (!selectedSellerAssignment) return;
    setIsSavingSellerDraft(true);
    try {
      const updated = await saveSellerListingAssignmentImportDraft(selectedSellerAssignment.id, {
        title: sellerImportForm.title.trim() || undefined,
        location: sellerImportForm.location.trim() || undefined,
        price: sellerImportForm.price.trim() ? Number(sellerImportForm.price) : undefined,
        type: sellerImportForm.type.trim() || undefined,
        kaek: sellerImportForm.kaek.trim() || undefined,
        googleMapsUrl: sellerImportForm.googleMapsUrl.trim() || undefined,
        googlePlaceId: sellerImportForm.googlePlaceId.trim() || undefined,
        latitude: sellerImportForm.latitude.trim() ? Number(sellerImportForm.latitude) : undefined,
        longitude: sellerImportForm.longitude.trim() ? Number(sellerImportForm.longitude) : undefined,
        listingUrl: sellerImportForm.listingUrl.trim() || undefined,
        referenceListingCode: sellerImportForm.referenceListingCode.trim() || undefined,
        listingCodes: parseCommaSeparatedValues(sellerImportForm.listingCodes),
        description: sellerImportForm.description.trim() || undefined,
        tags: parseCommaSeparatedValues(sellerImportForm.tags),
        sellerRejectsLoanBuyers: sellerImportForm.sellerRejectsLoanBuyers,
        step: sellerBuilderStep,
      });
      setSelectedSellerAssignment(updated);
      setSellerAssignments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      showToast(
        updated.importDraftSavedAt
          ? `Το draft αποθηκεύτηκε (${new Date(updated.importDraftSavedAt).toLocaleString('el-GR')}).`
          : 'Το draft αποθηκεύτηκε.',
        'success',
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Αποτυχία αποθήκευσης draft.', 'error');
    } finally {
      setIsSavingSellerDraft(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[var(--surface-ambient)]">
      <header className="border-b border-[var(--border-default)] bg-[var(--surface-glow)] px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Εντολές</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Canonical workspace για εντολές υπόδειξης και παραχώρησης, με review, υπογραφές και handoff στο επόμενο στάδιο.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={openCreateIndicationModal}
              className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
            >
              + Νέα Εντολή Υπόδειξης
            </button>
            <button
              onClick={() => setSellerAssignmentModalOpen(true)}
              className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
            >
              + Νέα Εντολή Παραχώρησης
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4">
            <p className="text-xs text-[var(--text-tertiary)]">Εντολές Υπόδειξης</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{stats.buyerTotal}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4">
            <p className="text-xs text-[var(--text-tertiary)]">Εντολές Παραχώρησης</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{stats.sellerTotal}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4">
            <p className="text-xs text-[var(--text-tertiary)]">Σε εκκρεμότητα</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{stats.sellerPending}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4">
            <p className="text-xs text-[var(--text-tertiary)]">Ακίνητα που εισήχθησαν</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{stats.sellerImported}</p>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-6 p-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UserRound size={18} className="text-[var(--brand-primary)]" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Εντολές Υπόδειξης</h2>
            </div>
            <button
              onClick={openCreateIndicationModal}
              className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
            >
              Νέα εντολή
            </button>
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Δημιουργία, review, υπογραφή και handoff σε δημιουργία συναλλαγής.
          </p>

          <div className="mt-4 space-y-3">
            {loading && <p className="text-sm text-[var(--text-secondary)]">Φόρτωση…</p>}
            {!loading && buyerIndications.length === 0 && (
              <p className="text-sm text-[var(--text-secondary)]">Δεν υπάρχουν εντολές υπόδειξης.</p>
            )}
            {buyerIndications.slice(0, 12).map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{item.propertyTitle}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.clientName ?? 'Υποψήφιος αγοραστής'} · {item.buyerEmail}</p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                    {buyerStatusLabel(item.status)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => void openIndicationReview(item.id)}
                    className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Άνοιγμα review
                  </button>
                  {item.dealReady && (
                    <button
                      onClick={() => {
                        setSelectedBuyerIndication(item);
                        setSelectedClientId(item.clientId ?? '');
                        setSelectedPropertyId(item.propertyId);
                        setCreateDealModalOpen(true);
                      }}
                      className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
                    >
                      Δημιουργία συναλλαγής
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSignature size={18} className="text-[var(--brand-primary)]" />
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Εντολές Παραχώρησης</h2>
            </div>
            <button
              onClick={() => setSellerAssignmentModalOpen(true)}
              className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
            >
              Νέα εντολή
            </button>
          </div>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Δημιουργία, review, υπογραφή, media collection και import του νέου ακινήτου.
          </p>

          <div className="mt-4 space-y-3">
            {loading && <p className="text-sm text-[var(--text-secondary)]">Φόρτωση…</p>}
            {!loading && sellerAssignments.length === 0 && (
              <p className="text-sm text-[var(--text-secondary)]">Δεν υπάρχουν εντολές παραχώρησης.</p>
            )}
            {sellerAssignments.slice(0, 12).map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{item.propertyTitle || 'Νέα εντολή παραχώρησης'}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.sellerFullName || 'Πωλητής'} · {item.sellerEmail}</p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      {item.importedPropertyTitle ? `Εισήχθη ως: ${item.importedPropertyTitle}` : 'Αναμένει υποβολή/έγκριση'}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(item.status)}`}>
                    {sellerStatusLabel(item.status)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => void openSellerAssignmentReview(item.id)}
                    className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Άνοιγμα review
                  </button>
                  <a
                    href={`/seller-listing-assignment/${item.publicToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
                  >
                    <ExternalLink size={13} />
                    Public link
                  </a>
                  <a
                    href={`mailto:${item.sellerEmail}?subject=${encodeURIComponent('Εντολή παραχώρησης ακινήτου')}&body=${encodeURIComponent(`Μπορείτε να συμπληρώσετε την εντολή παραχώρησης εδώ:\n${window.location.origin}/seller-listing-assignment/${item.publicToken}`)}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)]"
                  >
                    <Send size={13} />
                    Mail link
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {createIndicationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-[var(--surface-glow)] p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Νέα Εντολή Υπόδειξης</h3>
                <p className="text-sm text-[var(--text-tertiary)]">Ο μεσίτης ετοιμάζει και στέλνει το link της αρχικής συγκατάθεσης στον αγοραστή.</p>
              </div>
              <button className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]" onClick={() => setCreateIndicationModalOpen(false)} disabled={isCreatingIndication}>✕</button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Email αγοραστή</label>
                <input value={indicationBuyerEmail} onChange={(event) => setIndicationBuyerEmail(event.target.value)} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Ακίνητο</label>
                <select value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]">
                  <option value="">Επιλέξτε ακίνητο</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id} disabled={blacklistedPropertyIds.has(property.id)}>
                      {property.title}{blacklistedPropertyIds.has(property.id) ? ' [blacklisted]' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {indicationLoanRestricted && (
                <div className="md:col-span-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-sm text-[var(--status-warning-text)]">
                  Το lead {indicationMatchedClient?.name ?? indicationBuyerEmail.trim()} είναι σημειωμένο ως αγοραστής με δάνειο, ενώ ο πωλητής δεν δέχεται δάνειο για αυτό το ακίνητο.
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Λήξη link (ημέρες)</label>
                <input type="number" min={1} value={indicationExpiryDays} onChange={(event) => setIndicationExpiryDays(Number(event.target.value))} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Ονοματεπώνυμο μεσίτη</label>
                <input value={indicationBrokerName} onChange={(event) => setIndicationBrokerName(event.target.value)} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" />
              </div>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3">
                <label className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]">Γένος μεσίτη</label>
                <div className="flex gap-4 text-sm text-[var(--text-primary)]">
                  <label className="inline-flex items-center gap-2"><input type="radio" checked={indicationBrokerGender === 'male'} onChange={() => setIndicationBrokerGender('male')} />Αρσενικό</label>
                  <label className="inline-flex items-center gap-2"><input type="radio" checked={indicationBrokerGender === 'female'} onChange={() => setIndicationBrokerGender('female')} />Θηλυκό</label>
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3 md:col-span-2">
                <label className="mb-2 block text-xs font-semibold text-[var(--text-secondary)]">Μεσίτης / Μεσιτικό γραφείο στο έγγραφο</label>
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)]"><input type="radio" name="brokerIdentityMode" checked={indicationBrokerIdentityMode === 'self'} onChange={() => setIndicationBrokerIdentityMode('self')} />Ατομικά, με το ονοματεπώνυμο του μεσίτη</label>
                  <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)]"><input type="radio" name="brokerIdentityMode" checked={indicationBrokerIdentityMode === 'office'} onChange={() => setIndicationBrokerIdentityMode('office')} />Ως μεσιτικό γραφείο</label>
                </div>
                {indicationBrokerIdentityMode === 'office' && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Όνομα μεσιτικού γραφείου</label>
                    <input value={indicationBrokerOffice} onChange={(event) => setIndicationBrokerOffice(event.target.value)} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" />
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">% μεσίτη</label>
                <input type="number" min={0.1} step="0.1" value={indicationCommissionPct} onChange={(event) => setIndicationCommissionPct(event.target.value)} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Τ.Μ. ακινήτου</label>
                <input type="number" min={0} step="0.1" value={indicationPropertyArea} onChange={(event) => setIndicationPropertyArea(event.target.value)} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCreateIndicationModalOpen(false)} disabled={isCreatingIndication} className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)]">Ακύρωση</button>
              <button onClick={() => void handleCreateIndication()} disabled={isCreatingIndication} className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white">{isCreatingIndication ? 'Αποστολή...' : 'Αποστολή link'}</button>
            </div>
          </div>
        </div>
      )}

      {reviewIndicationModalOpen && selectedBuyerIndication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-[var(--surface-glow)] p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Review Εντολής Υπόδειξης</h3>
                <p className="text-sm text-[var(--text-tertiary)]">{selectedBuyerIndication.propertyTitle} • {selectedBuyerIndication.clientName ?? selectedBuyerIndication.buyerEmail}</p>
              </div>
              <button className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]" onClick={() => setReviewIndicationModalOpen(false)}>✕</button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Παραγόμενο έγγραφο</p>
                <div className="max-h-[60vh] overflow-auto">
                  <BuyerIndicationDocumentPreview indication={selectedBuyerIndication} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4 text-sm">
                  <p className="font-semibold text-[var(--text-primary)]">Κατάσταση</p>
                  <p className="mt-2 text-[var(--text-secondary)]">Status: {buyerStatusLabel(selectedBuyerIndication.status)}</p>
                  <p className="text-[var(--text-secondary)]">Κωδικός ακινήτου: {selectedBuyerIndication.propertyReferenceListingCode || '-'}</p>
                  <p className="text-[var(--text-secondary)]">Maps: <a className="text-[var(--brand-primary)] hover:underline" href={selectedBuyerIndication.propertyMapsUrl} target="_blank" rel="noreferrer">Άνοιγμα pin</a></p>
                  <p className="text-[var(--text-secondary)]">Αγοραστής: {selectedBuyerIndication.buyerFullName || '-'}</p>
                  <p className="text-[var(--text-secondary)]">ΑΔΤ / ΑΦΜ: {selectedBuyerIndication.buyerIdNumber || '-'} / {selectedBuyerIndication.buyerTaxId || '-'}</p>
                  <p className="text-[var(--text-secondary)]">Ραντεβού: {selectedBuyerIndication.appointmentStartAt ? `${new Date(selectedBuyerIndication.appointmentStartAt).toLocaleString('el-GR')} - ${selectedBuyerIndication.appointmentEndAt ? new Date(selectedBuyerIndication.appointmentEndAt).toLocaleString('el-GR') : '-'}` : '-'}</p>
                  <p className="text-[var(--text-secondary)]">Μεσίτης ραντεβού: {selectedBuyerIndication.appointmentBrokerName || '-'}</p>
                  <p className="text-[var(--text-secondary)]">Απάντηση ενδιαφέροντος: {selectedBuyerIndication.status === 'INTERESTED' ? 'Ναι' : selectedBuyerIndication.status === 'NOT_INTERESTED' ? 'Όχι' : '-'}</p>
                  {selectedBuyerIndication.buyerInterestComment && <p className="mt-2 text-[var(--text-secondary)]">Σχόλιο: {selectedBuyerIndication.buyerInterestComment}</p>}
                  <button onClick={() => void downloadGeneratedIndicationDocument(selectedBuyerIndication).catch(() => showToast('Αποτυχία λήψης του εγγράφου.', 'error'))} className="mt-3 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">Λήψη PDF</button>
                </div>

                {(selectedBuyerIndication.status === 'EXPIRED' || selectedBuyerIndication.status === 'RENEWAL_REQUESTED') && (
                  <div className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4">
                    <p className="text-sm font-semibold text-[var(--status-warning-text)]">Το link χρειάζεται επανέκδοση</p>
                    <button onClick={() => void handleResendIndication()} disabled={isResendingIndication} className="mt-3 rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white">{isResendingIndication ? 'Αποστολή...' : 'Νέο link'}</button>
                  </div>
                )}

                {selectedBuyerIndication.status === 'BROKER_REVIEW' && (
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                    <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Υπογραφή μεσίτη</p>
                    <SignaturePad value={brokerSignature} onChange={setBrokerSignature} />
                    <button onClick={() => void handleApproveIndication()} disabled={isApprovingIndication || !brokerSignature} className="mt-4 rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white">
                      {isApprovingIndication ? 'Έγκριση...' : 'Έγκριση'}
                    </button>
                  </div>
                )}

                {selectedBuyerIndication.appointmentBookingReady && (
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                    <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Ημερολόγιο ραντεβού υπόδειξης</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Επιλέξτε ημερομηνία από το ημερολόγιο, δείτε τα ήδη κλεισμένα ραντεβού του μεσίτη και ορίστε την ώρα για να σταλεί email στον αγοραστή με το πότε και πού.
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                      Το email για επιβεβαίωση ενδιαφέροντος αποστέλλεται 36 ώρες μετά τη λήξη του ραντεβού.
                    </p>
                    <button onClick={() => openAppointmentCalendar(selectedBuyerIndication)} className="mt-4 w-full rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white">
                      Άνοιγμα ημερολογίου
                    </button>
                  </div>
                )}

                {selectedBuyerIndication.dealReady && (
                  <button
                    onClick={() => {
                      setReviewIndicationModalOpen(false);
                      setSelectedClientId(selectedBuyerIndication.clientId ?? '');
                      setCreateDealModalOpen(true);
                    }}
                    className="w-full rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white"
                  >
                    Δημιουργία συναλλαγής
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {appointmentCalendarModalOpen && selectedBuyerIndication && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-xl bg-[var(--surface-glow)] shadow-xl">
            <div className="flex items-start justify-between border-b border-[var(--border-default)] px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Ημερολόγιο ραντεβού υπόδειξης</h3>
                <p className="text-sm text-[var(--text-tertiary)]">
                  {selectedBuyerIndication.propertyTitle} • {selectedBuyerIndication.propertyReferenceListingCode || 'Χωρίς κωδικό'}
                </p>
              </div>
              <button
                className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                onClick={() => setAppointmentCalendarModalOpen(false)}
                disabled={isBookingIndicationAppointment}
              >
                ✕
              </button>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="border-b border-[var(--border-default)] p-5 lg:border-b-0 lg:border-r">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <CalendarDays size={16} />
                  <span>Επιλογή ημέρας</span>
                </div>
                <UiCalendar
                  mode="single"
                  selected={selectedAppointmentDate}
                  onSelect={(date) => {
                    if (date) {
                      setAppointmentDateValue(formatCalendarDayKey(date));
                    }
                  }}
                  disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                  className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4"
                  components={{
                    DayContent: ({ date }) => {
                      const count = appointmentCountsByDay.get(formatCalendarDayKey(date)) ?? 0;
                      return (
                        <div className="flex h-full w-full flex-col items-center justify-center leading-none">
                          <span>{date.getDate()}</span>
                          {count > 0 && (
                            <span className="mt-1 rounded-full bg-[var(--brand-primary)] px-1.5 py-0.5 text-[9px] font-semibold text-white">
                              {count}
                            </span>
                          )}
                        </div>
                      );
                    },
                  }}
                />
                <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                  Οι παλιές ημερομηνίες είναι κλειδωμένες. Οι αριθμοί πάνω στις ημέρες δείχνουν πόσα άλλα ραντεβού έχει ήδη ο μεσίτης.
                </p>
              </div>

              <div className="max-h-[72vh] overflow-y-auto p-5">
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Καταχώριση ραντεβού</p>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    Με την αποθήκευση στέλνεται email στον αγοραστή με ημερομηνία, ώρα, κωδικό ακινήτου, τοποθεσία και pin χάρτη.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      Ημέρα
                      <input
                        value={appointmentDateValue}
                        readOnly
                        placeholder="Επιλέξτε ημέρα από το ημερολόγιο"
                        className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </label>
                    <label className="text-xs font-semibold text-[var(--text-secondary)]">
                      Μεσίτης ραντεβού
                      <input
                        value={appointmentBrokerName}
                        onChange={(event) => setAppointmentBrokerName(event.target.value)}
                        className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">
                        Ώρα έναρξης
                        <input
                          type="time"
                          value={appointmentStartTime}
                          onChange={(event) => setAppointmentStartTime(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                        />
                      </label>
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">
                        Ώρα λήξης
                        <input
                          type="time"
                          value={appointmentEndTime}
                          onChange={(event) => setAppointmentEndTime(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                        />
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={() => void handleBookIndicationAppointment()}
                    disabled={isBookingIndicationAppointment || !appointmentDateValue}
                    className="mt-4 w-full rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isBookingIndicationAppointment ? 'Καταχώριση...' : 'Αποθήκευση ραντεβού'}
                  </button>
                  <p className="mt-3 text-xs text-[var(--text-tertiary)]">
                    Το follow-up email για ενδιαφέρον φεύγει αυτόματα 36 ώρες μετά τη λήξη του ραντεβού.
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <Clock3 size={16} />
                    <span>Ραντεβού της επιλεγμένης ημέρας</span>
                  </div>
                  {selectedDayAppointments.length === 0 ? (
                    <p className="mt-3 text-sm text-[var(--text-tertiary)]">Δεν υπάρχουν άλλα ραντεβού για αυτή την ημέρα.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {selectedDayAppointments.map((appointment) => (
                        <div key={appointment.id} className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] p-3 text-sm">
                          <p className="font-semibold text-[var(--text-primary)]">
                            {appointment.propertyReferenceListingCode || appointment.propertyTitle}
                          </p>
                          <p className="mt-1 text-[var(--text-secondary)]">
                            {appointment.startAt.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })} - {appointment.endAt.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-[var(--text-secondary)]">{appointment.propertyTitle}</p>
                          <p className="text-[var(--text-tertiary)]">{appointment.buyerEmail}</p>
                          {appointment.appointmentBrokerName && (
                            <p className="text-[var(--text-tertiary)]">Μεσίτης: {appointment.appointmentBrokerName}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-4 text-sm text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                    <MapPin size={16} />
                    <span>Τι θα λάβει ο αγοραστής</span>
                  </div>
                  <p className="mt-2">Ακίνητο: {selectedBuyerIndication.propertyTitle}</p>
                  <p>Κωδικός: {selectedBuyerIndication.propertyReferenceListingCode || '-'}</p>
                  <p>Τοποθεσία: {selectedBuyerIndication.propertyAddress}, {selectedBuyerIndication.propertyRegion}</p>
                  <p className="mt-2">
                    Maps:{' '}
                    <a className="text-[var(--brand-primary)] hover:underline" href={selectedBuyerIndication.propertyMapsUrl} target="_blank" rel="noreferrer">
                      Άνοιγμα pin
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {createDealModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-[var(--surface-glow)] p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Νέα Συναλλαγή</h3>
                <p className="text-sm text-[var(--text-tertiary)]">
                  {selectedBuyerIndication ? 'Η συναλλαγή θα δημιουργηθεί πάνω στην εντολή υπόδειξης μόνο αφού ο αγοραστής δηλώσει ενδιαφέρον μετά το ραντεβού.' : 'Επιλέξτε πελάτη, ακίνητο και καλούπι εγγράφων.'}
                </p>
              </div>
              <button className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]" onClick={() => setCreateDealModalOpen(false)} disabled={isCreatingDeal}>✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Πελάτης</label>
                <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]">
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Ακίνητο</label>
                <select value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]">
                  {properties.map((property) => (
                    <option key={property.id} value={property.id} disabled={blacklistedPropertyIds.has(property.id)}>
                      {property.title}{blacklistedPropertyIds.has(property.id) ? ' [blacklisted]' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Καλούπι εγγράφων</label>
                <select
                  value={selectedDocTemplateId}
                  onChange={(event) => {
                    const nextDocTemplateId = event.target.value;
                    setSelectedDocTemplateId(nextDocTemplateId);
                    const nextProcessTemplateId = findMatchingProcessTemplateId(nextDocTemplateId, documentTemplates, processTemplates);
                    if (nextProcessTemplateId) {
                      setSelectedProcessTemplateId(nextProcessTemplateId);
                    }
                  }}
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  {documentTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">Καλούπι διαδικασίας</label>
                <select
                  value={selectedProcessTemplateId}
                  onChange={(event) => {
                    const nextProcessTemplateId = event.target.value;
                    setSelectedProcessTemplateId(nextProcessTemplateId);
                    const nextDocTemplateId = findMatchingDocumentTemplateId(nextProcessTemplateId, documentTemplates, processTemplates);
                    if (nextDocTemplateId) {
                      setSelectedDocTemplateId(nextDocTemplateId);
                    }
                  }}
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  {processTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </div>

              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Ομάδες που υποστηρίζουν το template</p>
                    <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                      Επίλεξε τις ομάδες που θα μπουν στη συναλλαγή για το επιλεγμένο process template. Αν δεν επιλέξεις καμία, η συναλλαγή θα βασιστεί μόνο στα default mappings του template όταν ξεκινήσει η διαδικασία.
                    </p>
                  </div>
                  {selectedTeamIds.length > 0 && (
                    <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-glow)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                      {selectedTeamIds.length} επιλεγμένες
                    </span>
                  )}
                </div>

                {loadingProcessTemplateTeams && (
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">Φόρτωση συμβατών ομάδων...</p>
                )}

                {!loadingProcessTemplateTeams && compatibleTeams.length === 0 && (
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    Δεν έχουν δηλωθεί ακόμη ομάδες για αυτό το process template στις αναθέσεις template.
                  </p>
                )}

                {!loadingProcessTemplateTeams && compatibleTeams.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {compatibleTeams.map((team) => {
                      const selected = selectedTeamIds.includes(team.id);
                      return (
                        <label
                          key={team.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition ${
                            selected
                              ? 'border-[var(--border-brand)] bg-[var(--surface-glow-active)]'
                              : 'border-[var(--border-default)] bg-[var(--surface-glow)] hover:bg-[var(--surface-glow-active)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelectedTeam(team.id)}
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{team.name}</p>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">
                              Καλύπτει: {team.slots.join(', ')}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCreateDealModalOpen(false)} disabled={isCreatingDeal} className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)]">Ακύρωση</button>
              <button onClick={() => void handleCreateDeal()} disabled={isCreatingDeal || !selectedDocTemplateId || !selectedProcessTemplateId} className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white">
                {isCreatingDeal ? 'Δημιουργία...' : 'Δημιουργία & Άνοιγμα Εγγράφων'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sellerAssignmentModalOpen && (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-black/30" onClick={() => { if (!creatingSellerAssignment) setSellerAssignmentModalOpen(false); }} />
          <div className="absolute left-1/2 top-1/2 w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-glow)] p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Νέα Εντολή Παραχώρησης</h3>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">Ο ιδιοκτήτης θα παραλάβει public link για στοιχεία, φωτογραφίες και υπογραφή.</p>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1">
                <span className="text-sm font-medium text-[var(--text-primary)]">Email πωλητή</span>
                <input autoFocus type="email" value={sellerEmail} onChange={(event) => setSellerEmail(event.target.value)} className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]" />
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Αμοιβή μεσίτη %</span>
                  <input type="number" min="0" step="0.1" value={sellerCommissionPct} onChange={(event) => setSellerCommissionPct(event.target.value)} className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Λήξη link σε ημέρες</span>
                  <input type="number" min="1" step="1" value={sellerExpiryDays} onChange={(event) => setSellerExpiryDays(Number(event.target.value))} className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm outline-none focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--brand-warm-muted)]" />
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setSellerAssignmentModalOpen(false)} disabled={creatingSellerAssignment} className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-highlight)] disabled:opacity-60">Ακύρωση</button>
              <button onClick={() => void handleCreateSellerAssignment()} disabled={creatingSellerAssignment} className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60">{creatingSellerAssignment ? 'Αποστολή...' : 'Αποστολή εντολής'}</button>
            </div>
          </div>
        </div>
      )}

      {reviewSellerAssignmentModalOpen && selectedSellerAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-[var(--surface-glow)] p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Review Εντολής Παραχώρησης</h3>
                <p className="text-sm text-[var(--text-tertiary)]">{selectedSellerAssignment.propertyTitle || 'Νέο ακίνητο'} • {selectedSellerAssignment.clientName || selectedSellerAssignment.sellerFullName || 'Πωλητής'}</p>
              </div>
              <button className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]" onClick={() => setReviewSellerAssignmentModalOpen(false)}>✕</button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                  <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Παραγόμενο έγγραφο</p>
                  <div className="max-h-[60vh] overflow-auto">
                    <SellerListingAssignmentDocumentPreview assignment={selectedSellerAssignment} />
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-tertiary)]">Ιδιοκτήτης</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedSellerAssignment.sellerFullName || selectedSellerAssignment.clientName || 'Πωλητής'}</p>
                      <p className="text-sm text-[var(--text-secondary)]">{selectedSellerAssignment.sellerPhone || '-'}</p>
                      <p className="text-sm text-[var(--text-secondary)]">ΑΔΤ / ΑΦΜ: {selectedSellerAssignment.sellerIdNumber || '-'} / {selectedSellerAssignment.sellerTaxId || '-'}</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Gov check: {selectedSellerAssignment.sellerTaxIdCheckedOnGov ? 'Ναι' : 'Όχι'}
                        {selectedSellerAssignment.sellerTaxIdCheckedAt ? ` • ${new Date(selectedSellerAssignment.sellerTaxIdCheckedAt).toLocaleString('el-GR', { timeZone: 'Europe/Athens' })}` : ''}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">{selectedSellerAssignment.sellerEmail}</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Ποσοστό μεσίτη: {selectedSellerAssignment.brokerCommissionPct}%
                        {selectedSellerAssignment.grossFeeWithVat != null ? ` • ${Number(selectedSellerAssignment.grossFeeWithVat).toLocaleString('el-GR', { style: 'currency', currency: 'EUR' })} με ΦΠΑ` : ''}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Εκπροσώπηση: {selectedSellerAssignment.actingMode === 'REPRESENTING_OTHER'
                          ? `${selectedSellerAssignment.actingOnBehalfOf || '-'} • ${selectedSellerAssignment.actingAuthorityType || '-'}`
                          : 'Ατομικά'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-tertiary)]">Στοιχεία ακινήτου</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedSellerAssignment.propertyTitle || '-'}</p>
                      <p className="text-sm text-[var(--text-secondary)]">{selectedSellerAssignment.propertyLocation || '-'}</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {selectedSellerAssignment.propertyType || '-'} • {selectedSellerAssignment.propertyIntent || '-'} • {selectedSellerAssignment.propertyPrice != null ? `€${Number(selectedSellerAssignment.propertyPrice).toLocaleString('el-GR')}` : '-'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Συνοδευτικά έγγραφα πωλητή</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Το συμβόλαιο, το ΠΕΑ και τυχόν εξουσιοδότηση ανεβαίνουν ξεχωριστά και ελέγχονται εδώ.</p>
                  </div>
                  <div className="space-y-3">
                    {(selectedSellerAssignment.supportingDocuments ?? []).map((document) => (
                      <div key={document.id} className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-primary)]">{document.name}</p>
                            <p className="text-xs text-[var(--text-tertiary)]">
                              {document.required ? 'Απαιτούμενο για την προετοιμασία συναλλαγής.' : 'Προαιρετικό, μόνο αν υπάρχει σχετική εξουσιοδότηση ή πληρεξούσιο.'}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">Status: {sellerSupportingDocumentStatusLabel(document.status)}</p>
                            {document.reviewerComment && (
                              <p className="mt-1 text-xs text-[var(--status-warning-text)]">Σχόλιο: {document.reviewerComment}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {document.filePreviewUrl && (
                              <a
                                href={document.filePreviewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                              >
                                Προβολή PDF
                              </a>
                            )}
                            {document.status !== 'APPROVED' && document.fileUrl && (
                              <button
                                onClick={() => void handleReviewSellerSupportingDocument(document.id, 'APPROVED')}
                                className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-xs font-semibold text-white"
                              >
                                Έγκριση
                              </button>
                            )}
                            {document.fileUrl && document.status !== 'REJECTED' && document.status !== 'APPROVED' && (
                              <button
                                onClick={() => void handleReviewSellerSupportingDocument(document.id, 'REJECTED')}
                                className="rounded-lg border border-[var(--status-danger-border)] px-3 py-2 text-xs font-semibold text-[var(--status-danger-text)]"
                              >
                                Απόρριψη
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Φωτογραφίες ακινήτου</p>
                      <p className="text-xs text-[var(--text-tertiary)]">Ο πωλητής ή ο μεσίτης μπορούν να ανεβάσουν φωτογραφίες πριν την εισαγωγή.</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-glow-active)]">
                      <Camera size={16} />
                      {isUploadingSellerPhoto ? 'Μεταφόρτωση...' : 'Προσθήκη φωτογραφίας'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={isUploadingSellerPhoto}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          void handleBrokerUploadSellerPhoto(file);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {(selectedSellerAssignment.photoPreviewUrls ?? []).map((photoUrl, index) => (
                      <img key={`${photoUrl}-${index}`} src={photoUrl} alt="Seller property" className="h-36 w-full rounded-lg object-cover" />
                    ))}
                    {(selectedSellerAssignment.photoPreviewUrls ?? []).length === 0 && (
                      <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-[var(--border-default)] text-sm text-[var(--text-tertiary)]">Δεν έχουν προστεθεί φωτογραφίες ακόμη.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4 text-sm">
                  <p className="font-semibold text-[var(--text-primary)]">Κατάσταση</p>
                  <p className="mt-2 text-[var(--text-secondary)]">Status: {sellerStatusLabel(selectedSellerAssignment.status)}</p>
                  <p className="text-[var(--text-secondary)]">Λήξη: {new Date(selectedSellerAssignment.expiresAt).toLocaleString('el-GR')}</p>
                  <button onClick={() => void downloadGeneratedSellerAssignmentDocument(selectedSellerAssignment).catch(() => showToast('Αποτυχία λήψης του εγγράφου.', 'error'))} className="mt-3 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">Λήψη PDF</button>
                  {selectedSellerAssignment.importedPropertyTitle && <p className="mt-2 text-[var(--text-secondary)]">Εισαγμένο ακίνητο: {selectedSellerAssignment.importedPropertyTitle}</p>}
                  <div className="mt-3 grid gap-2">
                    <button onClick={() => void copySellerAssignmentLink()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"><Copy size={14} />Αντιγραφή public link</button>
                    <a href={sellerAssignmentLink} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"><Link2 size={14} />Άνοιγμα public σελίδας</a>
                    <a href={`mailto:${selectedSellerAssignment.sellerEmail}?subject=${encodeURIComponent('Εντολή παραχώρησης ακινήτου')}&body=${encodeURIComponent(`Μπορείτε να συμπληρώσετε τα στοιχεία και να ανεβάσετε φωτογραφίες εδώ:\n${sellerAssignmentLink}`)}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"><Mail size={14} />Αποστολή με email</a>
                  </div>
                </div>

                {(selectedSellerAssignment.status === 'EXPIRED' || selectedSellerAssignment.status === 'RENEWAL_REQUESTED') && (
                  <div className="rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4">
                    <p className="text-sm font-semibold text-[var(--status-warning-text)]">Το link χρειάζεται επανέκδοση</p>
                    <button onClick={() => void handleResendSellerAssignment()} disabled={isResendingSellerAssignment} className="mt-3 rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white">{isResendingSellerAssignment ? 'Αποστολή...' : 'Νέο link'}</button>
                  </div>
                )}

                {selectedSellerAssignment.status === 'BROKER_REVIEW' && (
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                    <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Σχόλιο μεσίτη</p>
                    <textarea rows={4} value={sellerReviewComment} onChange={(event) => setSellerReviewComment(event.target.value)} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" placeholder="Προαιρετικό σχόλιο προς τον πωλητή ή για το import." />
                    <p className="mb-2 mt-4 text-sm font-semibold text-[var(--text-primary)]">Υπογραφή μεσίτη</p>
                    <SignaturePad value={sellerBrokerSignature} onChange={setSellerBrokerSignature} />
                    <button onClick={() => void handleApproveSellerAssignment()} disabled={isApprovingSellerAssignment || !sellerBrokerSignature} className="mt-4 w-full rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white">
                      {isApprovingSellerAssignment ? 'Έγκριση...' : 'Υπογραφή και συνέχεια σε builder'}
                    </button>
                  </div>
                )}

                {(selectedSellerAssignment.status === 'APPROVED' || selectedSellerAssignment.status === 'IMPORTED') && (
                  <button
                    onClick={() => {
                      syncSellerImportForm(selectedSellerAssignment);
                      setReviewSellerAssignmentModalOpen(false);
                      setSellerImportBuilderOpen(true);
                    }}
                    className="w-full rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white"
                  >
                    {selectedSellerAssignment.status === 'IMPORTED' ? 'Προβολή builder' : 'Εισαγωγή ακινήτου'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {sellerImportBuilderOpen && selectedSellerAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-[var(--surface-glow)] p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Builder Εισαγωγής Ακινήτου</h3>
                <p className="text-sm text-[var(--text-tertiary)]">Τα στοιχεία της εντολής παραχώρησης έχουν προ-συμπληρωθεί και μπορούν να τροποποιηθούν πριν το listing μπει στο σύστημα.</p>
              </div>
              <button className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]" onClick={() => setSellerImportBuilderOpen(false)}>✕</button>
            </div>

            <div className="mb-5 grid gap-3 md:grid-cols-3">
              {sellerBuilderSteps.map((step, index) => {
                const isActive = step.id === sellerBuilderStep;
                const isCompleted = SELLER_BUILDER_STEP_ORDER.indexOf(step.id) < SELLER_BUILDER_STEP_ORDER.indexOf(sellerBuilderStep);
                return (
                  <button key={step.id} type="button" onClick={() => setSellerBuilderStep(step.id)} className={`rounded-xl border px-4 py-3 text-left transition ${isActive ? 'border-[var(--border-brand)] bg-[var(--surface-highlight)]' : 'border-[var(--border-default)] bg-[var(--surface-ambient)] hover:bg-[var(--surface-glow-active)]'}`}>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">Βήμα {index + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{step.label}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{isCompleted ? 'Ολοκληρώθηκε' : isActive ? 'Τρέχον βήμα' : 'Σε αναμονή'}</p>
                  </button>
                );
              })}
            </div>

            {sellerBuilderStep === 'seller' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <GooglePlaceLookupPanel
                    value={sellerPlaceLookupQuery}
                    onChange={setSellerPlaceLookupQuery}
                    onError={(message) => showToast(message, 'error')}
                    onSelect={(place) => {
                      setSellerImportForm((prev) => ({
                        ...prev,
                        googlePlaceId: place.placeId ?? '',
                        googleMapsUrl: place.googleMapsUrl ?? '',
                        latitude: place.latitude != null ? String(place.latitude) : '',
                        longitude: place.longitude != null ? String(place.longitude) : '',
                        location: prev.location || place.formattedAddress || place.displayName || '',
                      }));
                      setSellerPlaceLookupQuery(place.formattedAddress ?? place.displayName ?? place.googleMapsUrl ?? '');
                      showToast('Το Google place επιλέχθηκε και συμπλήρωσε τα identity πεδία.', 'success');
                    }}
                    label="Google place search"
                    disabled={integrationsLookupLocked}
                    disabledMessage="Το Google Places lookup ανήκει στο Integrations plan και παραμένει Coming soon στο initial launch."
                  />
                </div>
                <label className="space-y-1"><span className="text-xs font-semibold text-[var(--text-secondary)]">Τίτλος listing</span><input value={sellerImportForm.title} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, title: event.target.value }))} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-[var(--text-secondary)]">Τοποθεσία</span><input value={sellerImportForm.location} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, location: event.target.value }))} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-[var(--text-secondary)]">Τύπος ακινήτου</span><input value={sellerImportForm.type} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, type: event.target.value }))} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-[var(--text-secondary)]">Τιμή</span><input type="number" min={0} value={sellerImportForm.price} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, price: event.target.value }))} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-[var(--text-secondary)]">KAEK</span><input value={sellerImportForm.kaek} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, kaek: event.target.value }))} placeholder="π.χ. 050123456789/0/0" className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-[var(--text-secondary)]">Google Place ID</span><input value={sellerImportForm.googlePlaceId} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, googlePlaceId: event.target.value }))} placeholder="π.χ. ChIJ..." className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-[var(--text-secondary)]">Google Maps URL</span><input value={sellerImportForm.googleMapsUrl} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, googleMapsUrl: event.target.value }))} placeholder="https://maps.google.com/..." className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-[var(--text-secondary)]">Latitude</span><input value={sellerImportForm.latitude} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, latitude: event.target.value }))} placeholder="π.χ. 37.8623456" className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-[var(--text-secondary)]">Longitude</span><input value={sellerImportForm.longitude} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, longitude: event.target.value }))} placeholder="π.χ. 23.7567890" className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <label className="space-y-1 md:col-span-2"><span className="text-xs font-semibold text-[var(--text-secondary)]">Listing URL</span><input value={sellerImportForm.listingUrl} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, listingUrl: event.target.value }))} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-[var(--text-secondary)]">Internal property ID</span><input value={sellerImportForm.referenceListingCode} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, referenceListingCode: event.target.value }))} placeholder="π.χ. SPT-48291" className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <label className="space-y-1"><span className="text-xs font-semibold text-[var(--text-secondary)]">Άλλοι κωδικοί listing</span><input value={sellerImportForm.listingCodes} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, listingCodes: event.target.value }))} placeholder="π.χ. RMX-48291, XE-7712" className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <p className="text-xs text-[var(--text-tertiary)] md:col-span-2">Για αποφυγή διπλοτύπου απαιτείται τουλάχιστον ένα από: KAEK, Google Place ID ή internal property ID, ακόμη και παλιός active code. Το Maps URL και οι συντεταγμένες είναι βοηθητικά στοιχεία.</p>
                <label className="space-y-1 md:col-span-2"><span className="text-xs font-semibold text-[var(--text-secondary)]">Περιγραφή</span><textarea rows={5} value={sellerImportForm.description} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, description: event.target.value }))} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" /></label>
                <label className="md:col-span-2 flex items-start gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--surface-ambient)] px-4 py-3 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={sellerImportForm.sellerRejectsLoanBuyers}
                    onChange={(event) => setSellerImportForm((prev) => ({ ...prev, sellerRejectsLoanBuyers: event.target.checked }))}
                    className="mt-0.5"
                  />
                  <span>Ο πωλητής δεν επιθυμεί αγοραστή με δάνειο.</span>
                </label>
              </div>
            )}

            {sellerBuilderStep === 'media' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Φωτογραφίες που συγκεντρώθηκαν</p>
                      <p className="text-xs text-[var(--text-tertiary)]">Ο broker μπορεί να προσθέσει επιπλέον φωτογραφίες πριν την εισαγωγή.</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)]">
                      <Upload size={16} />
                      {isUploadingSellerPhoto ? 'Μεταφόρτωση...' : 'Upload broker'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={isUploadingSellerPhoto}
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          void handleBrokerUploadSellerPhoto(file);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(selectedSellerAssignment.photoPreviewUrls ?? []).map((photoUrl, index) => (
                      <img key={`${photoUrl}-${index}`} src={photoUrl} alt="Property media" className="h-40 w-full rounded-lg object-cover" />
                    ))}
                    {(selectedSellerAssignment.photoPreviewUrls ?? []).length === 0 && (
                      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-[var(--border-default)] text-sm text-[var(--text-tertiary)]">Δεν υπάρχουν ακόμη φωτογραφίες.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {sellerBuilderStep === 'publish' && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Final property payload</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3"><p className="text-xs text-[var(--text-tertiary)]">Τίτλος</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{sellerImportForm.title || '-'}</p></div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3"><p className="text-xs text-[var(--text-tertiary)]">Τοποθεσία</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{sellerImportForm.location || '-'}</p></div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3"><p className="text-xs text-[var(--text-tertiary)]">Τύπος / Τιμή</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{sellerImportForm.type || '-'} • {sellerImportForm.price ? `€${Number(sellerImportForm.price).toLocaleString('el-GR')}` : '-'}</p></div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3"><p className="text-xs text-[var(--text-tertiary)]">Φωτογραφίες</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{selectedSellerAssignment.photoUrls?.length ?? 0}</p></div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3"><p className="text-xs text-[var(--text-tertiary)]">KAEK</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{sellerImportForm.kaek || '-'}</p></div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3"><p className="text-xs text-[var(--text-tertiary)]">Google Place ID</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{sellerImportForm.googlePlaceId || '-'}</p></div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3"><p className="text-xs text-[var(--text-tertiary)]">Google Maps</p><p className="mt-1 break-all text-sm font-semibold text-[var(--text-primary)]">{sellerImportForm.googleMapsUrl || '-'}</p></div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3"><p className="text-xs text-[var(--text-tertiary)]">Coordinates</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{sellerImportForm.latitude && sellerImportForm.longitude ? `${sellerImportForm.latitude}, ${sellerImportForm.longitude}` : '-'}</p></div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3"><p className="text-xs text-[var(--text-tertiary)]">Internal ID</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{sellerImportForm.referenceListingCode || '-'}</p></div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3"><p className="text-xs text-[var(--text-tertiary)]">Λοιποί κωδικοί</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{sellerImportForm.listingCodes || '-'}</p></div>
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-glow)] p-3"><p className="text-xs text-[var(--text-tertiary)]">Δάνειο αγοραστή</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{sellerImportForm.sellerRejectsLoanBuyers ? 'Δεν επιτρέπεται' : 'Επιτρέπεται'}</p></div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-ambient)] p-4">
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">Tags (comma separated)</span>
                      <textarea rows={8} value={sellerImportForm.tags} onChange={(event) => setSellerImportForm((prev) => ({ ...prev, tags: event.target.value }))} className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)]" placeholder="πωληση, νεο listing, γλυφαδα" />
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex gap-2">
                <button onClick={() => { const index = SELLER_BUILDER_STEP_ORDER.indexOf(sellerBuilderStep); if (index > 0) setSellerBuilderStep(SELLER_BUILDER_STEP_ORDER[index - 1]); }} disabled={sellerBuilderStep === 'seller'} className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50">Πίσω</button>
                <button onClick={() => { const index = SELLER_BUILDER_STEP_ORDER.indexOf(sellerBuilderStep); if (index < SELLER_BUILDER_STEP_ORDER.length - 1) setSellerBuilderStep(SELLER_BUILDER_STEP_ORDER[index + 1]); }} disabled={sellerBuilderStep === 'publish'} className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-50">Επόμενο</button>
                <button onClick={() => void handleSaveSellerImportDraft()} disabled={isSavingSellerDraft} className="rounded-lg border border-[var(--border-brand)] px-3 py-2 text-sm font-medium text-[var(--brand-primary)] disabled:opacity-50">
                  {isSavingSellerDraft ? 'Αποθήκευση...' : 'Αποθήκευση draft'}
                </button>
              </div>
              <div className="text-right">
                {selectedSellerAssignment.importDraftSavedAt && (
                  <p className="mb-2 text-xs text-[var(--text-tertiary)]">
                    Τελευταίο draft: {new Date(selectedSellerAssignment.importDraftSavedAt).toLocaleString('el-GR')}
                  </p>
                )}
                <button onClick={() => void handleImportSellerProperty()} disabled={isImportingSellerProperty || selectedSellerAssignment.status === 'IMPORTED'} className="rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[var(--surface-highlight)]">
                {selectedSellerAssignment.status === 'IMPORTED' ? 'Το ακίνητο έχει ήδη εισαχθεί' : isImportingSellerProperty ? 'Εισαγωγή...' : 'Ολοκλήρωση εισαγωγής ακινήτου'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

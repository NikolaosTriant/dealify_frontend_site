import type {
  ApiBillingCoupon,
  ApiBillingCouponPreview,
  ApiBillingOverview,
  ApiBillingPlan,
  ApiBrokerSignupCatalog,
  ApiBrokerSignupState,
  ApiBrokerSignupVerificationDispatch,
  ApiBuyerIndication,
  ApiClient,
  ApiCurrentUser,
  ApiDashboardAnalytics,
  ApiDeal,
  ApiDealAnalytics,
  ApiDealDocument,
  ApiDealDocumentStatus,
  ApiDealMember,
  ApiDealStage,
  ApiDocumentTemplate,
  ApiGroup,
  ApiImportResponse,
  ApiIntegrationConnection,
  ApiMatchProperty,
  ApiMemberDocument,
  ApiMemberTeam,
  ApiNotificationFeedItem,
  ApiProcessTemplate,
  ApiProcessTemplateTeamAssignment,
  ApiProfessionalRole,
  ApiProperty,
  ApiPropertyBlacklistEntry,
  ApiPropertyEngagement,
  ApiSellerListingAssignment,
  ApiTeamMember,
} from './trustlayerApi';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type AuthAudience = 'broker' | 'admin';

export const DEMO_MODE = ((import.meta.env.VITE_DEMO_MODE as string | undefined) ?? 'true') === 'true';
export const MOCK_UPLOAD_PREFIX = 'mock-upload://';

type MockDb = {
  properties: ApiProperty[];
  clients: ApiClient[];
  deals: ApiDeal[];
  dealDocuments: Record<string, ApiDealDocument[]>;
  dealStages: Record<string, ApiDealStage[]>;
  dealMembers: Record<string, ApiDealMember[]>;
  memberDocuments: Record<string, ApiMemberDocument[]>;
  clientGroups: ApiGroup[];
  propertyGroups: ApiGroup[];
  propertyBlacklist: ApiPropertyBlacklistEntry[];
  buyerIndications: ApiBuyerIndication[];
  sellerAssignments: ApiSellerListingAssignment[];
  documentTemplates: ApiDocumentTemplate[];
  processTemplates: ApiProcessTemplate[];
  teamAssignments: Record<string, ApiProcessTemplateTeamAssignment[]>;
  professionalRoles: ApiProfessionalRole[];
  memberTeams: ApiMemberTeam[];
  teamMembers: ApiTeamMember[];
  notifications: ApiNotificationFeedItem[];
  integrations: ApiIntegrationConnection[];
  billingPlans: ApiBillingPlan[];
  billingCoupons: ApiBillingCoupon[];
  billingOverview: ApiBillingOverview;
  onboarding: ApiBrokerSignupState | null;
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const nowIso = () => new Date().toISOString();
const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
const mockDownloadUrl = (name: string) =>
  `data:text/plain;charset=utf-8,${encodeURIComponent(`Demo file for ${name}`)}`;
const brokerToken = `mock.${btoa(JSON.stringify({ role: 'BROKER' }))}.token`;
const adminToken = `mock.${btoa(JSON.stringify({ role: 'ADMIN' }))}.token`;

const billingPlans: ApiBillingPlan[] = [
  {
    code: 'starter',
    name: 'Starter',
    description: 'Βασικό πλάνο',
    sortOrder: 1,
    monthlyPriceCents: 4900,
    yearlyPriceCents: 49000,
    integrationsEnabled: false,
    aiEnabled: false,
    graceIntegrationsEnabled: false,
    graceAiEnabled: false,
    graceEmailEnabled: true,
    graceSmsEnabled: true,
    graceApiEnabled: true,
    active: true,
    purchasable: true,
  } as ApiBillingPlan,
  {
    code: 'pro',
    name: 'Pro',
    description: 'Πλήρες orchestration',
    sortOrder: 2,
    monthlyPriceCents: 12900,
    yearlyPriceCents: 129000,
    integrationsEnabled: true,
    aiEnabled: true,
    emailMonthlyLimit: 5000,
    smsMonthlyLimit: 1000,
    apiMonthlyLimit: 50000,
    aiMonthlyLimit: 2000,
    graceIntegrationsEnabled: true,
    graceAiEnabled: true,
    graceEmailEnabled: true,
    graceSmsEnabled: true,
    graceApiEnabled: true,
    active: true,
    purchasable: true,
  } as ApiBillingPlan,
];

function initialDb(): MockDb {
  const properties: ApiProperty[] = [
    {
      id: '61111111-0000-0000-0000-000000000001',
      title: 'Βούλα, Κωνσταντίνου Καραμανλή 58 (3ος)',
      location: 'Βούλα',
      price: 280000,
      type: 'Apartment',
      referenceListingCode: 'VOU-280',
      listingCodes: ['SPIT-9911'],
      photos: ['https://placehold.co/800x500?text=Voula'],
      googleMapsUrl: 'https://maps.google.com/?q=Voula',
      tags: ['high-interest', 'south-suburbs'],
      sellerClientId: 'client-seller-1',
      sellerClientName: 'Αντώνης Παπαδόπουλος',
      createdAt: nowIso(),
    },
    {
      id: '61111111-0000-0000-0000-000000000003',
      title: 'Γλυφάδα, Λαζαράκη 91',
      location: 'Γλυφάδα',
      price: 335000,
      type: 'Apartment',
      referenceListingCode: 'GLY-335',
      photos: ['https://placehold.co/800x500?text=Glyfada'],
      tags: ['premium'],
      createdAt: nowIso(),
    },
    {
      id: '61111111-0000-0000-0000-000000000004',
      title: 'Ελληνικό, Ιασωνίδου 18',
      location: 'Ελληνικό',
      price: 510000,
      type: 'Commercial',
      referenceListingCode: 'ELL-510',
      photos: ['https://placehold.co/800x500?text=Elliniko'],
      tags: ['investment'],
      createdAt: nowIso(),
    },
  ];

  const clients: ApiClient[] = [
    {
      id: 'client-buyer-1',
      name: 'Μαρία & Νίκος',
      phone: '+306912345678',
      email: 'maria.nikos@example.com',
      tags: ['HIGH_VALUE', 'Βούλα', '3αρι'],
      groupIds: ['group-hot'],
      leadSource: 'Cost Calculator',
      createdAt: nowIso(),
    },
    {
      id: 'client-buyer-2',
      name: 'Αλέξανδρος Κ.',
      phone: '+306932345678',
      email: 'alex@example.com',
      tags: ['INVESTOR'],
      groupIds: ['group-follow'],
      leadSource: 'Public Link',
      createdAt: nowIso(),
    },
    {
      id: 'client-seller-1',
      name: 'Αντώνης Παπαδόπουλος',
      phone: '+306942345678',
      email: 'seller@example.com',
      tags: ['SELLER'],
      createdAt: nowIso(),
    },
  ];

  const deals: ApiDeal[] = [
    {
      id: '61111111-0000-0000-0000-000000000002',
      clientId: 'client-buyer-1',
      clientName: 'Μαρία & Νίκος',
      propertyId: properties[0].id,
      propertyTitle: properties[0].title,
      status: 'PROCESS_PHASE',
      documentsPhase: 'COMPLETE',
      clientLinkToken: 'preview-client-link',
      buyerLinkToken: 'preview-client-link',
      sellerLinkToken: 'seller-preview-link',
      publicRole: 'BUYER',
      createdAt: nowIso(),
    },
    {
      id: '61111111-0000-0000-0000-000000000005',
      clientId: 'client-buyer-2',
      clientName: 'Αλέξανδρος Κ.',
      propertyId: properties[1].id,
      propertyTitle: properties[1].title,
      status: 'DOCUMENTS_PHASE',
      documentsPhase: 'BUYER',
      clientLinkToken: 'second-client-link',
      buyerLinkToken: 'second-client-link',
      createdAt: nowIso(),
    },
  ];

  const dealMembers: Record<string, ApiDealMember[]> = {
    [deals[0].id]: [
      { id: 'member-lawyer-1', dealId: deals[0].id, role: 'LAWYER', name: 'Αλεξάνδρα Νικολάου', email: 'alexandra@legal.gr', phone: '+306955551111', linkToken: 'member-lawyer-link' },
      { id: 'member-engineer-1', dealId: deals[0].id, role: 'ENGINEER', name: 'Πέτρος Ιωάννου', email: 'petros@engineer.gr', phone: '+306955552222', linkToken: 'member-engineer-link' },
      { id: 'member-surveyor-1', dealId: deals[0].id, role: 'SURVEYOR', name: 'Κώστας Βλάχος', email: 'kostas@survey.gr', phone: '+306955553333', linkToken: 'member-surveyor-link' },
      { id: 'member-notary-1', dealId: deals[0].id, role: 'NOTARY', name: 'Μαρία Σταμάτη', email: 'notary@example.com', phone: '+306955554444', linkToken: 'member-notary-link' },
    ],
    [deals[1].id]: [
      { id: 'member-lawyer-2', dealId: deals[1].id, role: 'LAWYER', name: 'Σοφία Κρητικού', email: 'sofia@legal.gr', phone: '+306955555555', linkToken: 'member-lawyer-link-2' },
    ],
  };

  const dealDocuments: Record<string, ApiDealDocument[]> = {
    [deals[0].id]: [
      { id: 'deal-doc-1', name: 'Ταυτότητα Αγοραστή', category: 'Στοιχεία Συμβαλλομένων', status: 'APPROVED', partyRole: 'BUYER', fileUrl: mockDownloadUrl('tautotita.pdf'), uploadedAt: nowIso(), reviewerName: 'Γιώργος', reviewedAt: nowIso() },
      { id: 'deal-doc-2', name: 'ΑΦΜ Αγοραστή', category: 'Στοιχεία Συμβαλλομένων', status: 'APPROVED', partyRole: 'BUYER', fileUrl: mockDownloadUrl('afm.pdf'), uploadedAt: nowIso(), reviewerName: 'Γιώργος', reviewedAt: nowIso() },
      { id: 'deal-doc-3', name: 'Φορολογική Ενημερότητα', category: 'Φορολογικά', status: 'UPLOADED', partyRole: 'BUYER', fileUrl: mockDownloadUrl('forologiki.pdf'), uploadedAt: nowIso() },
      { id: 'deal-doc-4', name: 'Βεβαίωση ΕΝΦΙΑ', category: 'Φορολογικά', status: 'PENDING', partyRole: 'BUYER' },
      { id: 'deal-doc-5', name: 'Πιστοποιητικό Αποδοχής Κληρονομιάς', category: 'Νομικά', status: 'PENDING', partyRole: 'SELLER' },
    ],
    [deals[1].id]: [
      { id: 'deal-doc-6', name: 'Ταυτότητα Αγοραστή', category: 'Στοιχεία', status: 'UPLOADED', partyRole: 'BUYER' },
    ],
  };

  const dealStages: Record<string, ApiDealStage[]> = {
    [deals[0].id]: [
      { id: 'stage-legal-1', dealId: deals[0].id, memberId: 'member-lawyer-1', memberName: 'Αλεξάνδρα Νικολάου', title: 'Έλεγχος Τίτλων', status: 'COMPLETED', deadline: '2026-03-20', otpVerified: true, completedAt: nowIso() },
      { id: 'stage-legal-2', dealId: deals[0].id, memberId: 'member-lawyer-1', memberName: 'Αλεξάνδρα Νικολάου', title: 'Αποδοχή Κληρονομιάς', status: 'ACTIVE', dependencies: ['stage-legal-1'], deadline: '2026-04-05', otpVerified: false },
      { id: 'stage-eng-1', dealId: deals[0].id, memberId: 'member-engineer-1', memberName: 'Πέτρος Ιωάννου', title: 'Ηλεκτρονική Ταυτότητα Κτιρίου (ΗΤΚ)', status: 'ACTIVE', deadline: '2026-03-25', otpVerified: false, comment: 'Καθυστέρηση 2 ημερών' },
      { id: 'stage-surv-1', dealId: deals[0].id, memberId: 'member-surveyor-1', memberName: 'Κώστας Βλάχος', title: 'Τοπογραφικό Διάγραμμα', status: 'ACTIVE', deadline: '2026-04-02', otpVerified: false },
      { id: 'stage-notary-1', dealId: deals[0].id, memberId: 'member-notary-1', memberName: 'Μαρία Σταμάτη', title: 'Σύνταξη & Υπογραφή Συμβολαίου', status: 'LOCKED', dependencies: ['stage-legal-2', 'stage-eng-1', 'stage-surv-1'], deadline: '2026-04-20', otpVerified: false },
    ],
    [deals[1].id]: [
      { id: 'stage-2-1', dealId: deals[1].id, memberId: 'member-lawyer-2', memberName: 'Σοφία Κρητικού', title: 'Έλεγχος Εγγράφων', status: 'ACTIVE', deadline: '2026-04-10', otpVerified: false },
    ],
  };

  const memberDocuments: Record<string, ApiMemberDocument[]> = {
    [deals[0].id]: [
      { id: 'member-doc-1', dealId: deals[0].id, stageId: 'stage-legal-2', stageTitle: 'Αποδοχή Κληρονομιάς', memberId: 'member-lawyer-1', memberName: 'Αλεξάνδρα Νικολάου', role: 'LAWYER', name: 'Πράξη Αποδοχής Κληρονομιάς', status: 'UPLOADED', fileUrl: mockDownloadUrl('inheritance.pdf'), uploadedAt: nowIso() },
      { id: 'member-doc-2', dealId: deals[0].id, stageId: 'stage-eng-1', stageTitle: 'ΗΤΚ', memberId: 'member-engineer-1', memberName: 'Πέτρος Ιωάννου', role: 'ENGINEER', name: 'Αρχείο ΗΤΚ', status: 'PENDING' },
    ],
    [deals[1].id]: [],
  };

  const buyerIndications: ApiBuyerIndication[] = [
    {
      id: 'buyer-ind-1',
      clientId: 'client-buyer-1',
      clientName: 'Μαρία & Νίκος',
      propertyId: properties[0].id,
      propertyTitle: properties[0].title,
      propertyReferenceListingCode: properties[0].referenceListingCode,
      status: 'BROKER_REVIEW',
      buyerEmail: 'buyer@example.com',
      publicToken: 'demo-indication-token',
      expiresAt: '2026-04-30T12:00:00Z',
      sentAt: nowIso(),
      brokerName: 'Γιώργος Τριανταφύλλου',
      brokerOffice: 'Davlos Γλυφάδας',
      brokerGender: 'MALE',
      brokerIdentityMode: 'OFFICE',
      brokerCommissionPct: 2,
      grossFeeWithVat: 5600,
      propertyArea: 95,
      propertyAddress: properties[0].title,
      propertyRegion: 'Βούλα',
      propertyType: 'Διαμέρισμα',
      propertyValue: 280000,
      propertyMapsUrl: 'https://maps.google.com/?q=Voula',
      fixedDocumentCity: 'Γλυφάδα',
      expired: false,
      renewalAllowed: false,
      reviewReady: true,
      appointmentBookingReady: false,
      interestResponsePending: false,
      dealReady: true,
    } as ApiBuyerIndication,
  ];

  const sellerAssignments: ApiSellerListingAssignment[] = [
    {
      id: 'seller-assignment-1',
      clientId: 'client-seller-1',
      clientName: 'Αντώνης Παπαδόπουλος',
      status: 'BROKER_REVIEW',
      sellerEmail: 'seller@example.com',
      brokerCommissionPct: 2,
      publicToken: 'demo-seller-assignment-token',
      expiresAt: '2026-04-30T12:00:00Z',
      sentAt: nowIso(),
      propertyTitle: 'Διαμέρισμα 95τμ',
      propertyLocation: 'Βούλα',
      propertyRegion: 'Βούλα',
      propertyStreet: 'Κωνσταντίνου Καραμανλή',
      propertyStreetNumber: '58',
      propertyType: 'Διαμέρισμα',
      propertyIntent: 'Πώληση',
      propertyFloor: '3ος',
      propertyPrice: 280000,
      propertyArea: 95,
      sellerFullName: 'Αντώνης Παπαδόπουλος',
      sellerPhone: '+306944445555',
      sellerGender: 'MALE',
      sellerFatherName: 'Νίκος',
      sellerIdNumber: 'AB123456',
      sellerTaxId: '123456789',
      sellerCity: 'Βούλα',
      sellerStreet: 'Κωνσταντίνου Καραμανλή',
      sellerStreetNumber: '58',
      actingMode: 'INDIVIDUAL',
      grossFeeWithVat: 5600,
      supportingDocuments: [
        { id: 'sad-1', documentType: 'TITLE_DEED', name: 'Τίτλος Ιδιοκτησίας', required: true, status: 'UPLOADED', fileUrl: mockDownloadUrl('title.pdf') },
        { id: 'sad-2', documentType: 'ENERGY_CERTIFICATE', name: 'ΠΕΑ', required: true, status: 'PENDING' },
      ],
      photoUrls: ['https://placehold.co/800x500?text=Seller+photo'],
      photoPreviewUrls: ['https://placehold.co/800x500?text=Seller+photo'],
      expired: false,
      renewalAllowed: false,
      reviewReady: true,
      imported: false,
    } as ApiSellerListingAssignment,
  ];

  const processTemplates: ApiProcessTemplate[] = [
    {
      id: 'proc-template-1',
      name: 'Κληρονομιά + Πώληση',
      type: 'inheritance-sale',
      systemDefault: true,
      createdAt: nowIso(),
      stages: [
        { title: 'Έλεγχος Τίτλων', role: 'LAWYER', dependencies: [], deadlineDays: 5 },
        { title: 'ΗΤΚ', role: 'ENGINEER', dependencies: [], deadlineDays: 30 },
        { title: 'Τοπογραφικό', role: 'SURVEYOR', dependencies: [], deadlineDays: 7 },
        { title: 'Σύνταξη Συμβολαίου', role: 'NOTARY', dependencies: ['Έλεγχος Τίτλων', 'ΗΤΚ', 'Τοπογραφικό'], deadlineDays: 5 },
      ],
    },
  ];

  const professionalRoles: ApiProfessionalRole[] = [
    { id: 'role-lawyer', code: 'lawyer', label: 'Δικηγόρος', legacyMemberRole: 'LAWYER', system: true },
    { id: 'role-engineer', code: 'engineer', label: 'Μηχανικός', legacyMemberRole: 'ENGINEER', system: true },
    { id: 'role-surveyor', code: 'surveyor', label: 'Τοπογράφος', legacyMemberRole: 'SURVEYOR', system: true },
    { id: 'role-notary', code: 'notary', label: 'Συμβολαιογράφος', legacyMemberRole: 'NOTARY', system: true },
  ];

  const memberTeams: ApiMemberTeam[] = [
    { id: 'team-1', name: 'Νομικός Πυρήνας Νοτίων', coverageAreas: ['Βούλα', 'Γλυφάδα'], createdAt: nowIso() },
    { id: 'team-2', name: 'Τεχνικοί Συνεργάτες', coverageAreas: ['Βούλα', 'Άλιμος'], createdAt: nowIso() },
  ];

  const teamMembers: ApiTeamMember[] = [
    { id: 'tm-1', teamId: 'team-1', teamName: 'Νομικός Πυρήνας Νοτίων', role: 'LAWYER', professionalRoleId: 'role-lawyer', professionalRoleName: 'Δικηγόρος', name: 'Αλεξάνδρα Νικολάου', email: 'alexandra@legal.gr', phone: '+306955551111' },
    { id: 'tm-2', teamId: 'team-2', teamName: 'Τεχνικοί Συνεργάτες', role: 'ENGINEER', professionalRoleId: 'role-engineer', professionalRoleName: 'Μηχανικός', name: 'Πέτρος Ιωάννου', email: 'petros@engineer.gr', phone: '+306955552222' },
    { id: 'tm-3', teamId: 'team-2', teamName: 'Τεχνικοί Συνεργάτες', role: 'SURVEYOR', professionalRoleId: 'role-surveyor', professionalRoleName: 'Τοπογράφος', name: 'Κώστας Βλάχος', email: 'survey@example.com', phone: '+306955553333' },
  ];

  const integrations: ApiIntegrationConnection[] = [
    { provider: 'META_LEADS', status: 'CONNECTED', health: 'HEALTHY', metadata: { page_id: '123456789' }, connectedAt: nowIso(), lastSyncAt: nowIso(), consecutiveFailureCount: 0 },
    { provider: 'EMAIL_GMAIL', status: 'DISCONNECTED', health: 'DISCONNECTED', consecutiveFailureCount: 0 },
  ];

  const billingOverview: ApiBillingOverview = {
    subscriptionStatus: 'ACTIVE',
    currentPlan: billingPlans[1],
    availablePlans: billingPlans,
    integrationsEnabled: true,
    aiEnabled: true,
    emailAllowed: true,
    smsAllowed: true,
    apiAllowed: true,
    entitlementOverrideActive: false,
    usage: [
      { metric: 'EMAILS', usedCount: 120, limit: 5000, unlimited: false, periodStart: nowIso(), periodEnd: '2026-04-30T00:00:00Z' },
      { metric: 'SMS', usedCount: 44, limit: 1000, unlimited: false, periodStart: nowIso(), periodEnd: '2026-04-30T00:00:00Z' },
    ],
    startedAt: nowIso(),
    currentPeriodStart: nowIso(),
    currentPeriodEnd: '2026-04-30T00:00:00Z',
    billingInterval: 'monthly',
    catalogAmountCents: 12900,
    effectiveAmountCents: 12900,
    billingCustomerLinked: true,
  } as ApiBillingOverview;

  return {
    properties,
    clients,
    deals,
    dealDocuments,
    dealStages,
    dealMembers,
    memberDocuments,
    clientGroups: [
      { id: 'group-hot', name: 'High Value', filters: { priority: true }, createdAt: nowIso() },
      { id: 'group-follow', name: 'Follow-up', filters: { priority: false }, createdAt: nowIso() },
    ],
    propertyGroups: [
      { id: 'prop-group-1', name: 'Νότια Προάστια €200-350K', filters: { location: 'Νότια Προάστια' }, createdAt: nowIso() },
      { id: 'prop-group-2', name: 'Επενδυτικά Κέντρο', filters: { type: 'Commercial' }, createdAt: nowIso() },
    ],
    propertyBlacklist: [],
    buyerIndications,
    sellerAssignments,
    documentTemplates: [
      {
        id: 'doc-template-1',
        name: 'Κληρονομιά + Πώληση Διαμερίσματος',
        type: 'inheritance-sale',
        systemDefault: true,
        createdAt: nowIso(),
        documents: [
          { name: 'Ταυτότητα Αγοραστή', required: true, partyRole: 'BUYER', collectionPhase: true },
          { name: 'ΑΦΜ Αγοραστή', required: true, partyRole: 'BUYER', collectionPhase: true },
          { name: 'Πιστοποιητικό Αποδοχής Κληρονομιάς', required: true, partyRole: 'SELLER', collectionPhase: true },
        ],
      },
    ],
    processTemplates,
    teamAssignments: {
      'proc-template-1': [
        { teamId: 'team-1', teamName: 'Νομικός Πυρήνας Νοτίων', role: 'LAWYER', professionalRoleId: 'role-lawyer', professionalRoleName: 'Δικηγόρος', teamMemberId: 'tm-1', teamMemberName: 'Αλεξάνδρα Νικολάου' },
        { teamId: 'team-2', teamName: 'Τεχνικοί Συνεργάτες', role: 'ENGINEER', professionalRoleId: 'role-engineer', professionalRoleName: 'Μηχανικός', teamMemberId: 'tm-2', teamMemberName: 'Πέτρος Ιωάννου' },
      ],
    },
    professionalRoles,
    memberTeams,
    teamMembers,
    notifications: [
      { id: 'notif-1', dealId: deals[0].id, type: 'overdue', channel: 'system', message: '⚠ Ο Πέτρος Ιωάννου καθυστερεί 2 ημέρες στην ΗΤΚ', sentAt: nowIso(), readAt: null },
      { id: 'notif-2', dealId: deals[0].id, type: 'completed', channel: 'system', message: '✓ Η Αλεξάνδρα Νικολάου ολοκλήρωσε τον Έλεγχο Τίτλων', sentAt: nowIso(), readAt: null },
      { id: 'notif-3', dealId: deals[0].id, type: 'document', channel: 'email', message: '📄 Η Μαρία & Νίκος ανέβασαν νέα έγγραφα', sentAt: nowIso(), readAt: nowIso() },
    ],
    integrations,
    billingPlans,
    billingCoupons: [{ id: 'coupon-1', code: 'PILOT20', name: 'Pilot 20%', percentOff: 20, active: true, redemptionCount: 2 }] as ApiBillingCoupon[],
    billingOverview,
    onboarding: null,
  };
}

let db = initialDb();

function addNotification(message: string, type = 'document', dealId = db.deals[0]?.id) {
  db.notifications.unshift({ id: createId('notif'), dealId, type, channel: 'system', message, sentAt: nowIso(), readAt: null });
}

function publicDeal(token: string) {
  return db.deals.find((deal) => deal.clientLinkToken === token || deal.buyerLinkToken === token || deal.sellerLinkToken === token)
    ?? db.deals[0];
}

function publicMember(token: string) {
  return Object.values(db.dealMembers).flat().find((member) => member.linkToken === token)
    ?? Object.values(db.dealMembers).flat()[0];
}

function updateDocumentStatus(doc: ApiDealDocument | ApiMemberDocument, status: ApiDealDocumentStatus, reviewerComment?: string) {
  doc.status = status;
  doc.reviewerComment = reviewerComment;
  doc.reviewerName = 'Γιώργος Τριανταφύλλου';
  doc.reviewedAt = nowIso();
}

export function getMockToken(audience: AuthAudience) {
  return audience === 'admin' ? adminToken : brokerToken;
}

export function isMockUploadUrl(url?: string | null) {
  return Boolean(url && url.startsWith(MOCK_UPLOAD_PREFIX));
}

export async function mockRequest<T>(path: string, options: { method?: HttpMethod; body?: unknown; tokenAudience?: AuthAudience } = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const url = new URL(path, 'http://mock.local');
  const pathname = url.pathname;
  const body = (options.body ?? {}) as Record<string, unknown>;

  if (pathname === '/api/auth/login' && method === 'POST') return { token: brokerToken } as T;
  if (pathname === '/api/auth/admin/login' && method === 'POST') return { token: adminToken } as T;
  if (pathname === '/api/auth/password-reset/request' || pathname === '/api/auth/password-reset/confirm') return undefined as T;

  if (pathname === '/api/auth/onboarding/plans') return { plans: clone(db.billingPlans) } as T;
  if (pathname === '/api/auth/onboarding/start' && method === 'POST') {
    db.onboarding = {
      token: createId('signup'),
      email: String(body.email ?? 'broker@example.com'),
      fullName: String(body.fullName ?? 'Demo Broker'),
      businessName: String(body.businessName ?? 'Davlos Real Estate'),
      gemiNumber: String(body.gemiNumber ?? '123456789000'),
      taxId: String(body.taxId ?? '123456789'),
      phone: String(body.phone ?? '+306900000000'),
      selectedPlanCode: String(body.selectedPlanCode ?? 'pro'),
      selectedBillingInterval: (body.selectedBillingInterval as 'monthly' | 'yearly' | undefined) ?? 'monthly',
      selectedPlanName: 'Pro',
      status: 'PENDING_VERIFICATION',
      emailVerified: false,
      phoneVerified: false,
      businessVerified: false,
      activated: false,
      createdAt: nowIso(),
    };
    return { signup: clone(db.onboarding), debugCode: '123456' } as T;
  }
  if (pathname.startsWith('/api/auth/onboarding/')) {
    const token = pathname.split('/')[4];
    const signup = db.onboarding && db.onboarding.token === token ? db.onboarding : null;
    if (!signup) throw new Error('Mock onboarding not found');
    if (method === 'GET' && pathname.split('/').length === 5) return clone(signup) as T;
    if (pathname.endsWith('/email/request')) return { signup: clone(signup), debugCode: '123456' } as T;
    if (pathname.endsWith('/email/verify')) { signup.emailVerified = true; return { signup: clone(signup), debugCode: '123456' } as T; }
    if (pathname.endsWith('/phone/request')) return { signup: clone(signup), debugCode: '654321' } as T;
    if (pathname.endsWith('/phone/verify')) { signup.phoneVerified = true; return { signup: clone(signup), debugCode: '654321' } as T; }
    if (pathname.endsWith('/business/verify')) { signup.businessVerified = true; signup.status = 'READY_FOR_CHECKOUT'; return clone(signup) as T; }
    if (pathname.endsWith('/checkout/session')) { signup.activated = true; signup.status = 'ACTIVATED'; signup.activatedAt = nowIso(); return { sessionId: 'demo-checkout', url: '/dashboard' } as T; }
  }

  if (pathname === '/api/me') {
    const currentUser: ApiCurrentUser = {
      authenticated: true,
      id: options.tokenAudience === 'admin' ? 'admin-1' : 'broker-1',
      email: options.tokenAudience === 'admin' ? 'admin@davlos.local' : 'broker@davlos.gr',
      name: options.tokenAudience === 'admin' ? 'Admin User' : 'Γιώργος Τριανταφύλλου',
      company: 'Davlos Real Estate',
    };
    return currentUser as T;
  }

  if (pathname === '/api/billing/overview') return clone(db.billingOverview) as T;
  if (pathname === '/api/billing/plans') return clone(db.billingPlans) as T;
  if (pathname === '/api/billing/coupons/preview') {
    const coupon = db.billingCoupons[0];
    const preview: ApiBillingCouponPreview = {
      code: coupon.code,
      name: coupon.name,
      description: coupon.description ?? null,
      percentOff: coupon.percentOff,
      applicablePlanCode: coupon.applicablePlanCode ?? null,
      validFrom: null,
      validUntil: null,
      maxRedemptions: null,
      redemptionCount: coupon.redemptionCount,
    };
    return preview as T;
  }
  if (pathname === '/api/billing/checkout/session') return { sessionId: 'demo-session', url: '/settings' } as T;
  if (pathname === '/api/billing/portal/session') return { url: '/settings' } as T;
  if (pathname === '/api/billing/change-plan/schedule') return { id: createId('change'), currentPlanCode: 'pro', targetPlanCode: String(body.planCode ?? 'starter'), status: 'PENDING' } as T;
  if (pathname === '/api/billing/admin/dashboard') {
    return {
      totalBrokerUsers: 27,
      totalAdminUsers: 2,
      billingCustomersLinked: 19,
      totalPlans: db.billingPlans.length,
      customPlanCount: 1,
      totalSubscriptions: 24,
      activeSubscriptions: 21,
      trialSubscriptions: 2,
      pastDueSubscriptions: 1,
      canceledSubscriptions: 0,
      mrrCents: 182000,
      arrCents: 2184000,
      plans: db.billingPlans.map((plan) => ({
        code: plan.code,
        name: plan.name,
        subscriberCount: plan.code === 'pro' ? 18 : 6,
        activeSubscriberCount: plan.code === 'pro' ? 16 : 5,
      })),
      recentSafetyEvents: [],
      unlimitedSafetySettings: {
        enabled: true,
        apiCallsWindowMinutes: 10,
        apiCallsPerWindow: 500,
        emailWindowMinutes: 60,
        emailsPerWindow: 200,
        smsWindowMinutes: 60,
        smsPerWindow: 50,
        aiWindowMinutes: 10,
        aiRequestsPerWindow: 100,
        warningThresholdPercent: 80,
      },
    } as T;
  }
  if (pathname === '/api/billing/admin/coupons') {
    if (method === 'GET') return clone(db.billingCoupons) as T;
    const coupon = { id: createId('coupon'), active: true, redemptionCount: 0, ...(body as object) } as ApiBillingCoupon;
    db.billingCoupons.unshift(coupon);
    return clone(coupon) as T;
  }
  if (pathname === '/api/billing/admin/subscriptions') {
    return {
      items: [
        {
          id: 'sub-1',
          brokerId: 'broker-1',
          brokerEmail: 'broker@davlos.gr',
          brokerName: 'Γιώργος Τριανταφύλλου',
          companyName: 'Davlos Real Estate',
          planCode: 'pro',
          planName: 'Pro',
          status: 'ACTIVE',
          createdAt: nowIso(),
          currentPeriodEnd: '2026-04-30T00:00:00Z',
        },
      ],
      total: 1,
    } as T;
  }
  if (pathname.startsWith('/api/billing/admin/subscriptions/') || pathname.startsWith('/api/billing/admin/plans/')) return { id: createId('admin'), status: 'ACTIVE' } as T;
  if (pathname === '/api/billing/admin/plans' && method === 'POST') {
    const plan = { ...(body as object), active: true, purchasable: true } as ApiBillingPlan;
    db.billingPlans.push(plan);
    return clone(plan) as T;
  }

  if (pathname === '/api/notifications') return clone(db.notifications) as T;
  if (pathname === '/api/notifications/read-all') {
    db.notifications = db.notifications.map((item) => ({ ...item, readAt: item.readAt ?? nowIso() }));
    return { updated: db.notifications.length } as T;
  }
  if (pathname === '/api/notifications/nudge' || pathname.startsWith('/api/public/notifications/nudge/')) {
    addNotification(`📩 Υπενθύμιση στάλθηκε${body.message ? `: ${String(body.message)}` : ''}`, 'reminder', String(body.dealId ?? db.deals[0].id));
    return { sent: true } as T;
  }

  if (pathname === '/api/properties' && method === 'GET') return clone(db.properties) as T;
  if (pathname.includes('/audit-export')) return new Blob(['mock export']) as T;
  if (pathname.startsWith('/api/properties/google-places/search')) {
    return [{ placeId: 'place-voula', displayName: 'Βούλα', formattedAddress: 'Βούλα, Αττική', googleMapsUrl: 'https://maps.google.com/?q=Voula', latitude: 37.84, longitude: 23.77 }] as T;
  }
  if (pathname === '/api/properties/blacklist') {
    if (method === 'GET') return clone(db.propertyBlacklist) as T;
    const entry = { id: createId('blacklist'), createdAt: nowIso(), ...(body as object) } as ApiPropertyBlacklistEntry;
    db.propertyBlacklist.unshift(entry);
    return clone(entry) as T;
  }
  if (pathname.startsWith('/api/properties/blacklist/') && method === 'DELETE') {
    const id = pathname.split('/').pop()!;
    db.propertyBlacklist = db.propertyBlacklist.filter((entry) => entry.id !== id);
    return undefined as T;
  }
  if (pathname.startsWith('/api/properties/') && method === 'PUT') {
    const propertyId = pathname.split('/')[3];
    db.properties = db.properties.map((property) => property.id === propertyId ? { ...property, ...(body as object) } as ApiProperty : property);
    return clone(db.properties.find((property) => property.id === propertyId)!) as T;
  }

  if (pathname === '/api/clients') {
    if (method === 'GET') return clone(db.clients) as T;
    const client = { id: createId('client'), createdAt: nowIso(), ...(body as object) } as ApiClient;
    db.clients.unshift(client);
    return clone(client) as T;
  }
  if (pathname.startsWith('/api/clients/') && method === 'PUT') {
    const clientId = pathname.split('/')[3];
    db.clients = db.clients.map((client) => client.id === clientId ? { ...client, ...(body as object) } as ApiClient : client);
    return clone(db.clients.find((client) => client.id === clientId)!) as T;
  }

  if (pathname === '/api/deals') {
    if (method === 'GET') return clone(db.deals) as T;
    const client = db.clients.find((item) => item.id === body.clientId) ?? db.clients[0];
    const property = db.properties.find((item) => item.id === body.propertyId) ?? db.properties[0];
    const deal: ApiDeal = {
      id: createId('deal'),
      clientId: client.id,
      clientName: client.name,
      propertyId: property.id,
      propertyTitle: property.title,
      status: 'DOCUMENTS_PHASE',
      documentsPhase: 'BUYER',
      clientLinkToken: createId('client-link'),
      buyerLinkToken: createId('buyer-link'),
      createdAt: nowIso(),
    };
    db.deals.unshift(deal);
    db.dealDocuments[deal.id] = [];
    db.dealStages[deal.id] = [];
    db.dealMembers[deal.id] = [];
    db.memberDocuments[deal.id] = [];
    return clone(deal) as T;
  }
  if (pathname.startsWith('/api/deals/')) {
    const segments = pathname.split('/').filter(Boolean);
    const dealId = segments[2];
    const deal = db.deals.find((item) => item.id === dealId)!;
    if (segments.length === 3 && method === 'GET') return clone(deal) as T;
    if (pathname.endsWith('/start-process')) { deal.status = 'PROCESS_PHASE'; deal.documentsPhase = 'COMPLETE'; return clone(deal) as T; }
    if (pathname.endsWith('/documents/advance')) { deal.documentsPhase = deal.documentsPhase === 'SELLER' ? 'BUYER' : 'COMPLETE'; return clone(deal) as T; }
    if (pathname.endsWith('/complete')) { deal.status = 'COMPLETED'; deal.completedAt = nowIso(); return clone(deal) as T; }
    if (pathname.endsWith('/documents') && method === 'GET') return clone(db.dealDocuments[dealId] ?? []) as T;
    if (pathname.includes('/documents/') && pathname.endsWith('/assign')) {
      const doc = (db.dealDocuments[dealId] ?? []).find((item) => item.id === segments[4])!;
      doc.assignedRole = body.role as any;
      return clone(doc) as T;
    }
    if (pathname.includes('/documents/') && pathname.endsWith('/review')) {
      const doc = (db.dealDocuments[dealId] ?? []).find((item) => item.id === segments[4])!;
      updateDocumentStatus(doc, body.status as ApiDealDocumentStatus, body.reviewerComment as string | undefined);
      return clone(doc) as T;
    }
    if (pathname.includes('/documents/') && pathname.endsWith('/download-url')) return { downloadUrl: mockDownloadUrl(`deal-${segments[4]}.pdf`) } as T;
  }

  if (pathname === '/api/members' && method === 'POST') {
    const member = { id: createId('member'), linkToken: createId('member-link'), ...(body as object) } as ApiDealMember;
    (db.dealMembers[String(body.dealId)] ??= []).push(member);
    return clone(member) as T;
  }
  if (pathname.startsWith('/api/members?dealId=')) {
    const dealId = url.searchParams.get('dealId')!;
    return clone(db.dealMembers[dealId] ?? []) as T;
  }
  if (pathname.startsWith('/api/members/') && method === 'PUT') {
    const memberId = pathname.split('/')[3];
    for (const dealId of Object.keys(db.dealMembers)) {
      db.dealMembers[dealId] = db.dealMembers[dealId].map((member) => member.id === memberId ? { ...member, ...(body as object) } as ApiDealMember : member);
    }
    return clone(Object.values(db.dealMembers).flat().find((member) => member.id === memberId)!) as T;
  }
  if (pathname.startsWith('/api/members/') && method === 'DELETE') {
    const memberId = pathname.split('/')[3];
    for (const dealId of Object.keys(db.dealMembers)) {
      db.dealMembers[dealId] = db.dealMembers[dealId].filter((member) => member.id !== memberId);
    }
    return undefined as T;
  }

  if (pathname === '/api/member-teams') {
    if (method === 'GET') return clone(db.memberTeams) as T;
    const team = { id: createId('team'), createdAt: nowIso(), ...(body as object) } as ApiMemberTeam;
    db.memberTeams.push(team);
    return clone(team) as T;
  }
  if (pathname.startsWith('/api/member-teams/suggestions')) return clone(db.memberTeams.map((team, index) => ({ id: team.id, name: team.name, coverageAreas: team.coverageAreas, score: 90 - index * 10 }))) as T;
  if (pathname.startsWith('/api/member-teams/') && method === 'PUT') {
    const teamId = pathname.split('/')[3];
    db.memberTeams = db.memberTeams.map((team) => team.id === teamId ? { ...team, ...(body as object) } as ApiMemberTeam : team);
    return clone(db.memberTeams.find((team) => team.id === teamId)!) as T;
  }
  if (pathname.startsWith('/api/member-teams/') && method === 'DELETE') {
    const teamId = pathname.split('/')[3];
    db.memberTeams = db.memberTeams.filter((team) => team.id !== teamId);
    return undefined as T;
  }

  if (pathname.startsWith('/api/team-members')) {
    if (method === 'GET') {
      const teamId = url.searchParams.get('teamId');
      return clone(teamId ? db.teamMembers.filter((member) => member.teamId === teamId) : db.teamMembers) as T;
    }
    const member = { id: createId('team-member'), ...(body as object) } as ApiTeamMember;
    db.teamMembers.push(member);
    return clone(member) as T;
  }
  if (pathname.startsWith('/api/team-members/') && method === 'PUT') {
    const id = pathname.split('/')[3];
    db.teamMembers = db.teamMembers.map((member) => member.id === id ? { ...member, ...(body as object) } as ApiTeamMember : member);
    return clone(db.teamMembers.find((member) => member.id === id)!) as T;
  }
  if (pathname.startsWith('/api/team-members/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    db.teamMembers = db.teamMembers.filter((member) => member.id !== id);
    return undefined as T;
  }

  if (pathname === '/api/professional-roles') {
    if (method === 'GET') return clone(db.professionalRoles) as T;
    const role = { id: createId('role'), system: false, ...(body as object) } as ApiProfessionalRole;
    db.professionalRoles.push(role);
    return clone(role) as T;
  }
  if (pathname.startsWith('/api/professional-roles/') && method === 'PUT') {
    const id = pathname.split('/')[3];
    db.professionalRoles = db.professionalRoles.map((role) => role.id === id ? { ...role, ...(body as object) } as ApiProfessionalRole : role);
    return clone(db.professionalRoles.find((role) => role.id === id)!) as T;
  }
  if (pathname.startsWith('/api/professional-roles/') && method === 'DELETE') {
    const id = pathname.split('/')[3];
    db.professionalRoles = db.professionalRoles.filter((role) => role.id !== id);
    return undefined as T;
  }

  if (pathname === '/api/templates/processes') {
    if (method === 'GET') return clone(db.processTemplates) as T;
    const template = { id: createId('proc-template'), systemDefault: false, createdAt: nowIso(), ...(body as object) } as ApiProcessTemplate;
    db.processTemplates.unshift(template);
    return clone(template) as T;
  }
  if (pathname.startsWith('/api/templates/processes/') && pathname.endsWith('/team-assignments')) {
    const templateId = pathname.split('/')[4];
    if (method === 'GET') return clone(db.teamAssignments[templateId] ?? []) as T;
    db.teamAssignments[templateId] = (body as Array<Record<string, unknown>>).map((assignment) => ({
      teamId: String(assignment.teamId),
      teamName: db.memberTeams.find((team) => team.id === assignment.teamId)?.name ?? 'Ομάδα',
      role: assignment.role as any,
      professionalRoleId: assignment.professionalRoleId as string | undefined,
      professionalRoleName: db.professionalRoles.find((role) => role.id === assignment.professionalRoleId)?.label,
      partyRole: assignment.partyRole as any,
      teamMemberId: assignment.teamMemberId as string | undefined,
      teamMemberName: db.teamMembers.find((member) => member.id === assignment.teamMemberId)?.name,
    }));
    return clone(db.teamAssignments[templateId]) as T;
  }
  if (pathname.startsWith('/api/templates/processes/') && method === 'PUT') {
    const id = pathname.split('/')[4];
    db.processTemplates = db.processTemplates.map((template) => template.id === id ? { ...template, ...(body as object) } as ApiProcessTemplate : template);
    return clone(db.processTemplates.find((template) => template.id === id)!) as T;
  }
  if (pathname.startsWith('/api/templates/processes/') && method === 'DELETE') {
    const id = pathname.split('/')[4];
    db.processTemplates = db.processTemplates.filter((template) => template.id !== id);
    return undefined as T;
  }

  if (pathname === '/api/templates/documents') {
    if (method === 'GET') return clone(db.documentTemplates) as T;
    const template = { id: createId('doc-template'), systemDefault: false, createdAt: nowIso(), ...(body as object) } as ApiDocumentTemplate;
    db.documentTemplates.unshift(template);
    return clone(template) as T;
  }
  if (pathname.startsWith('/api/templates/documents/') && method === 'PUT') {
    const id = pathname.split('/')[4];
    db.documentTemplates = db.documentTemplates.map((template) => template.id === id ? { ...template, ...(body as object) } as ApiDocumentTemplate : template);
    return clone(db.documentTemplates.find((template) => template.id === id)!) as T;
  }
  if (pathname.startsWith('/api/templates/documents/') && method === 'DELETE') {
    const id = pathname.split('/')[4];
    db.documentTemplates = db.documentTemplates.filter((template) => template.id !== id);
    return undefined as T;
  }

  if (pathname === '/api/groups/clients') {
    if (method === 'GET') return clone(db.clientGroups) as T;
    const group = { id: createId('client-group'), createdAt: nowIso(), filters: {}, ...(body as object) } as ApiGroup;
    db.clientGroups.push(group);
    return clone(group) as T;
  }
  if (pathname === '/api/groups/properties') {
    if (method === 'GET') return clone(db.propertyGroups) as T;
    const group = { id: createId('property-group'), createdAt: nowIso(), filters: {}, ...(body as object) } as ApiGroup;
    db.propertyGroups.push(group);
    return clone(group) as T;
  }

  if (pathname.startsWith('/api/stages/deal/')) {
    const segments = pathname.split('/').filter(Boolean);
    const dealId = segments[3];
    if (segments.length === 4 && method === 'GET') return clone(db.dealStages[dealId] ?? []) as T;
    const stageId = segments[4];
    const stage = (db.dealStages[dealId] ?? []).find((item) => item.id === stageId)!;
    if (pathname.endsWith('/assignee')) {
      const member = (db.dealMembers[dealId] ?? []).find((item) => item.id === body.memberId);
      stage.memberId = member?.id;
      stage.memberName = member?.name;
      return clone(stage) as T;
    }
    if (pathname.endsWith('/status')) {
      stage.status = body.status as any;
      stage.comment = body.comment as string | undefined;
      if (stage.status === 'COMPLETED') stage.completedAt = nowIso();
      return clone(stage) as T;
    }
    if (pathname.endsWith('/deadline')) {
      stage.deadline = String(body.deadline ?? stage.deadline ?? '');
      return clone(stage) as T;
    }
  }

  if (pathname === '/api/analytics/dashboard') {
    const analytics: ApiDashboardAnalytics = {
      avgDealDays: 47,
      activeDeals: db.deals.filter((deal) => deal.status !== 'COMPLETED').length,
      completedDeals: db.deals.filter((deal) => deal.status === 'COMPLETED').length,
      bottleneckStage: 'Ηλεκτρονική Ταυτότητα Κτιρίου (ΗΤΚ)',
    };
    return analytics as T;
  }
  if (pathname.startsWith('/api/analytics/deal/')) {
    const analytics: ApiDealAnalytics = {
      dealId: pathname.split('/').pop()!,
      totalDays: 38,
      stageDurationsDays: {
        'Έλεγχος Τίτλων': 5,
        'Αποδοχή Κληρονομιάς': 8,
        'Ηλεκτρονική Ταυτότητα Κτιρίου (ΗΤΚ)': 28,
        'Τοπογραφικό Διάγραμμα': 9,
      },
      slowestStage: 'Ηλεκτρονική Ταυτότητα Κτιρίου (ΗΤΚ)',
      fastestStage: 'Έλεγχος Τίτλων',
      memberAvgDays: {
        'Αλεξάνδρα Νικολάου': 2.1,
        'Πέτρος Ιωάννου': 4.5,
        'Κώστας Βλάχος': 3.0,
        'Μαρία Σταμάτη': 1.0,
      },
    };
    return analytics as T;
  }
  if (pathname === '/api/engagement/properties') {
    const engagement: ApiPropertyEngagement[] = [
      {
        propertyId: db.properties[0].id,
        totalViews: 1194,
        saves: 96,
        inquiries: 13,
        repeatVisitors: 44,
        viewsOverTime: [110, 125, 140, 165, 182, 205, 220, 244],
        visitors: [
          { id: 'visitor-1', alias: 'Μαρία & Νίκος', email: 'maria.nikos@example.com', phone: '+306912345678', visits: 4, timeSpent: '14m 10s', alsoViewed: ['Γλυφάδα', 'Ελληνικό'] },
        ],
      },
      {
        propertyId: db.properties[1].id,
        totalViews: 812,
        saves: 51,
        inquiries: 7,
        repeatVisitors: 23,
        viewsOverTime: [72, 80, 96, 112, 121, 136, 144, 151],
        visitors: [],
      },
    ];
    return engagement as T;
  }

  if (pathname === '/api/matching/properties') {
    return clone(db.properties.map((property) => ({ id: property.id, title: property.title, location: property.location, price: property.price, type: property.type, tags: property.tags } as ApiMatchProperty))) as T;
  }
  if (pathname.includes('/send-suggestions')) {
    const clientId = pathname.split('/')[4];
    const client = db.clients.find((item) => item.id === clientId);
    return { clientId, recipientEmail: client?.email ?? 'client@example.com', matchedCount: 3, sent: true } as T;
  }
  if (pathname.includes('/auto')) {
    const clientId = pathname.split('/')[4];
    return { clientId, properties: clone(db.properties.map((property) => ({ id: property.id, title: property.title, location: property.location, price: property.price, type: property.type, tags: property.tags } as ApiMatchProperty))) } as T;
  }

  if (pathname === '/api/integrations') return clone(db.integrations) as T;
  if (pathname.includes('/connect')) {
    const provider = pathname.split('/')[3];
    const connection = { provider, status: 'CONNECTED', health: 'HEALTHY', metadata: (body.metadata as Record<string, string> | undefined) ?? {}, connectedAt: nowIso(), lastSyncAt: nowIso(), consecutiveFailureCount: 0 } as ApiIntegrationConnection;
    db.integrations = [...db.integrations.filter((item) => item.provider !== provider), connection];
    return clone(connection) as T;
  }
  if (pathname.includes('/disconnect')) {
    const provider = pathname.split('/')[3];
    const connection = { provider, status: 'DISCONNECTED', health: 'DISCONNECTED', consecutiveFailureCount: 0 } as ApiIntegrationConnection;
    db.integrations = [...db.integrations.filter((item) => item.provider !== provider), connection];
    return clone(connection) as T;
  }
  if (pathname === '/api/integrations/admin/diagnostics') {
    return {
      connections: clone(db.integrations.map((connection) => ({ ...connection, severity: 'INFO' }))),
      recentEvents: [
        { id: 'diag-1', provider: 'META_LEADS', severity: 'INFO', eventType: 'SYNC_SUCCESS', message: 'Το sync ολοκληρώθηκε επιτυχώς.', createdAt: nowIso() },
      ],
    } as T;
  }

  if (pathname === '/api/buyer-indications') {
    if (method === 'GET') return clone(db.buyerIndications) as T;
    const indication = { id: createId('buyer-ind'), publicToken: createId('buyer-public'), status: 'SENT', expiresAt: '2026-04-30T12:00:00Z', sentAt: nowIso(), fixedDocumentCity: 'Γλυφάδα', expired: false, renewalAllowed: false, reviewReady: false, appointmentBookingReady: false, interestResponsePending: false, dealReady: false, ...(body as object) } as ApiBuyerIndication;
    db.buyerIndications.unshift(indication);
    return clone(indication) as T;
  }
  if (pathname.startsWith('/api/buyer-indications/')) {
    const id = pathname.split('/')[3];
    const indication = db.buyerIndications.find((item) => item.id === id)!;
    if (pathname.endsWith('/resend')) { indication.sentAt = nowIso(); return clone(indication) as T; }
    if (pathname.endsWith('/approve')) { indication.status = 'APPROVED'; indication.approvedAt = nowIso(); return clone(indication) as T; }
    if (pathname.endsWith('/book-appointment')) {
      indication.status = 'APPOINTMENT_BOOKED';
      indication.appointmentBookedAt = nowIso();
      indication.appointmentStartAt = String(body.appointmentStartAt ?? '');
      indication.appointmentEndAt = String(body.appointmentEndAt ?? '');
      indication.appointmentBrokerName = String(body.appointmentBrokerName ?? '');
      return clone(indication) as T;
    }
    if (pathname.endsWith('/document')) return new Blob(['buyer indication']) as T;
    return clone(indication) as T;
  }

  if (pathname === '/api/seller-listing-assignments') {
    if (method === 'GET') return clone(db.sellerAssignments) as T;
    const assignment = { id: createId('seller-assignment'), publicToken: createId('seller-public'), status: 'SENT', expiresAt: '2026-04-30T12:00:00Z', sentAt: nowIso(), expired: false, renewalAllowed: false, reviewReady: false, imported: false, supportingDocuments: [], ...(body as object) } as ApiSellerListingAssignment;
    db.sellerAssignments.unshift(assignment);
    return clone(assignment) as T;
  }
  if (pathname.startsWith('/api/seller-listing-assignments/')) {
    const segments = pathname.split('/').filter(Boolean);
    const id = segments[2];
    const assignment = db.sellerAssignments.find((item) => item.id === id)!;
    if (segments.length === 3 && method === 'GET') return clone(assignment) as T;
    if (pathname.endsWith('/resend')) { assignment.sentAt = nowIso(); return clone(assignment) as T; }
    if (pathname.endsWith('/approve')) { assignment.status = 'APPROVED'; assignment.approvedAt = nowIso(); return clone(assignment) as T; }
    if (pathname.endsWith('/document')) return new Blob(['seller listing assignment']) as T;
    if (pathname.endsWith('/photos/upload-url')) return { uploadUrl: `${MOCK_UPLOAD_PREFIX}${id}/photo`, fileUrl: mockDownloadUrl('photo.jpg') } as T;
    if (pathname.endsWith('/photos')) {
      assignment.photoUrls = [...(assignment.photoUrls ?? []), String(body.fileUrl ?? mockDownloadUrl('photo.jpg'))];
      assignment.photoPreviewUrls = assignment.photoUrls;
      return clone(assignment) as T;
    }
    if (pathname.includes('/documents/') && pathname.endsWith('/review')) {
      const documentId = segments[4];
      assignment.supportingDocuments = (assignment.supportingDocuments ?? []).map((doc) =>
        doc.id === documentId ? { ...doc, status: body.status as ApiDealDocumentStatus, reviewerComment: body.reviewerComment as string | undefined, reviewerName: 'Γιώργος', reviewedAt: nowIso() } : doc,
      );
      return clone(assignment) as T;
    }
    if (pathname.endsWith('/import-property')) {
      const imported = { id: createId('property'), createdAt: nowIso(), ...(body as object) } as ApiProperty;
      db.properties.unshift(imported);
      assignment.imported = true;
      assignment.importedPropertyId = imported.id;
      assignment.importedPropertyTitle = imported.title;
      assignment.importedAt = nowIso();
      return clone(imported) as T;
    }
    if (pathname.endsWith('/import-draft')) return clone({ ...assignment, ...(body as object), importDraftSavedAt: nowIso() }) as T;
  }

  if (pathname.startsWith('/api/public/buyer-indications/')) {
    const token = pathname.split('/')[4];
    const indication = db.buyerIndications.find((item) => item.publicToken === token) ?? db.buyerIndications[0];
    if (pathname.endsWith('/submit')) { Object.assign(indication, body, { submittedAt: nowIso(), reviewReady: true }); return clone(indication) as T; }
    if (pathname.includes('/buyer-profile')) return { source: 'DATABASE', buyerFullName: 'Μαρία Κ.', buyerGender: 'FEMALE', buyerFatherName: 'Ιωάννης', buyerIdNumber: 'AB123456', buyerTaxId: url.searchParams.get('taxId') ?? '123456789', buyerCity: 'Βούλα', buyerStreet: 'Καραμανλή', buyerStreetNumber: '58', buyerPhone: '+306912345678' } as T;
    if (pathname.endsWith('/request-renewal')) return { requested: true } as T;
    if (pathname.endsWith('/interest-response')) {
      indication.status = body.interested ? 'INTERESTED' : 'NOT_INTERESTED';
      indication.buyerInterestComment = body.comment as string | undefined;
      indication.interestResponseAt = nowIso();
      return clone(indication) as T;
    }
    return clone(indication) as T;
  }

  if (pathname.startsWith('/api/public/seller-listing-assignments/')) {
    const token = pathname.split('/')[4];
    const assignment = db.sellerAssignments.find((item) => item.publicToken === token) ?? db.sellerAssignments[0];
    if (pathname.endsWith('/submit')) { Object.assign(assignment, body, { submittedAt: nowIso(), reviewReady: true }); return clone(assignment) as T; }
    if (pathname.endsWith('/request-renewal')) return { requested: true } as T;
    if (pathname.endsWith('/photos/upload-url')) return { uploadUrl: `${MOCK_UPLOAD_PREFIX}${token}/photo`, fileUrl: mockDownloadUrl('seller-photo.jpg') } as T;
    if (pathname.endsWith('/photos')) {
      assignment.photoUrls = [...(assignment.photoUrls ?? []), String(body.fileUrl ?? mockDownloadUrl('seller-photo.jpg'))];
      assignment.photoPreviewUrls = assignment.photoUrls;
      return clone(assignment) as T;
    }
    if (pathname.includes('/documents/') && pathname.endsWith('/upload-url')) return { uploadUrl: `${MOCK_UPLOAD_PREFIX}${token}/seller-doc`, fileUrl: mockDownloadUrl('seller-doc.pdf') } as T;
    if (pathname.includes('/documents/') && method === 'POST') {
      const documentId = pathname.split('/')[6];
      assignment.supportingDocuments = (assignment.supportingDocuments ?? []).map((doc) =>
        doc.id === documentId ? { ...doc, fileUrl: String(body.fileUrl ?? mockDownloadUrl('seller-doc.pdf')), status: 'UPLOADED', uploadedAt: nowIso() } : doc,
      );
      return clone(assignment) as T;
    }
    return clone(assignment) as T;
  }

  if (pathname.startsWith('/api/public/deals/')) {
    const token = pathname.split('/')[4];
    const deal = publicDeal(token);
    if (pathname.endsWith('/documents')) return clone(db.dealDocuments[deal.id] ?? []) as T;
    if (pathname.includes('/documents/') && pathname.endsWith('/upload-url')) return { uploadUrl: `${MOCK_UPLOAD_PREFIX}${token}/deal-doc`, fileUrl: mockDownloadUrl('deal-doc.pdf') } as T;
    if (pathname.includes('/documents/') && pathname.endsWith('/complete')) {
      const documentId = pathname.split('/')[6];
      const doc = (db.dealDocuments[deal.id] ?? []).find((item) => item.id === documentId)!;
      doc.fileUrl = String(body.fileUrl ?? mockDownloadUrl('deal-doc.pdf'));
      doc.status = 'UPLOADED';
      doc.uploadedAt = nowIso();
      return clone(doc) as T;
    }
    if (pathname.includes('/documents/') && pathname.endsWith('/download-url')) return { downloadUrl: mockDownloadUrl('public-deal-doc.pdf') } as T;
    if (pathname.endsWith('/members')) return clone(db.dealMembers[deal.id] ?? []) as T;
    if (pathname.endsWith('/stages')) return clone(db.dealStages[deal.id] ?? []) as T;
    return clone(deal) as T;
  }

  if (pathname.startsWith('/api/public/members/')) return clone(publicMember(pathname.split('/')[4])) as T;

  if (pathname.startsWith('/api/public/member-documents/')) {
    const segments = pathname.split('/').filter(Boolean);
    const token = segments[3];
    const member = publicMember(token);
    const docs = clone(db.memberDocuments[member.dealId] ?? []).filter((doc) => doc.memberId === member.id);
    const sellerDocs = clone(db.dealDocuments[member.dealId] ?? []).filter((doc) => doc.partyRole === 'SELLER');
    const roleDocs = clone(db.dealDocuments[member.dealId] ?? []).filter((doc) => doc.assignedRole === member.role || !doc.assignedRole);
    if (segments.length === 4) return docs as T;
    if (pathname.endsWith('/seller-documents')) return sellerDocs as T;
    if (pathname.endsWith('/role-documents')) return roleDocs as T;
    if (pathname.endsWith('/upload-url')) return { uploadUrl: `${MOCK_UPLOAD_PREFIX}${token}/member-doc`, fileUrl: mockDownloadUrl('member-doc.pdf') } as T;
    if (pathname.endsWith('/complete')) {
      const documentId = segments[5];
      const doc = (db.memberDocuments[member.dealId] ?? []).find((item) => item.id === documentId)!;
      doc.fileUrl = String(body.fileUrl ?? mockDownloadUrl('member-doc.pdf'));
      doc.status = 'UPLOADED';
      doc.uploadedAt = nowIso();
      return clone(doc) as T;
    }
    if (pathname.endsWith('/download-url')) return { downloadUrl: mockDownloadUrl('member-doc.pdf') } as T;
    if (pathname.includes('/role-documents/') && pathname.endsWith('/review')) {
      const documentId = segments[6];
      const doc = (db.dealDocuments[member.dealId] ?? []).find((item) => item.id === documentId)!;
      updateDocumentStatus(doc, body.status as ApiDealDocumentStatus, body.reviewerComment as string | undefined);
      return clone(doc) as T;
    }
  }

  if (pathname === '/api/member-documents/deal/' + pathname.split('/').pop()) return clone(db.memberDocuments[pathname.split('/').pop()!] ?? []) as T;
  if (pathname.startsWith('/api/member-documents/deal/')) {
    const segments = pathname.split('/').filter(Boolean);
    const dealId = segments[3];
    if (segments.length === 4 && method === 'GET') return clone(db.memberDocuments[dealId] ?? []) as T;
    const documentId = segments[4];
    if (pathname.endsWith('/review')) {
      const doc = (db.memberDocuments[dealId] ?? []).find((item) => item.id === documentId)!;
      updateDocumentStatus(doc, body.status as ApiDealDocumentStatus, body.reviewerComment as string | undefined);
      return clone(doc) as T;
    }
    if (pathname.endsWith('/download-url')) return { downloadUrl: mockDownloadUrl('member-role-doc.pdf') } as T;
  }

  if (pathname === '/api/lead-sources') return [] as T;
  if (pathname.includes('/import/csv')) {
    const response: ApiImportResponse = { totalRows: 3, importedRows: 3, failedRows: 0, errors: [] };
    return response as T;
  }

  throw new Error(`No mock handler for ${method} ${path}`);
}

export async function mockRequestBlob(): Promise<Blob> {
  return new Blob(['mock blob']);
}

export async function mockUploadCsv(): Promise<ApiImportResponse> {
  return { totalRows: 3, importedRows: 3, failedRows: 0, errors: [] };
}

import { DEMO_MODE, getMockToken, isMockUploadUrl, mockRequest, mockRequestBlob, mockUploadCsv } from './trustlayerApi.mock';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  ?? 'http://localhost:8080';

const BROKER_TOKEN_STORAGE_KEY = 'trustlayer_jwt';
const ADMIN_TOKEN_STORAGE_KEY = 'trustlayer_admin_jwt';
const BROKER_TOKEN_SESSION_STORAGE_KEY = 'trustlayer_jwt_session';
const ADMIN_TOKEN_SESSION_STORAGE_KEY = 'trustlayer_admin_jwt_session';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type AuthAudience = 'broker' | 'admin';

export type ApiProperty = {
  id: string;
  title: string;
  location: string;
  price: number;
  type: string;
  description?: string;
  listingUrl?: string;
  kaek?: string;
  googleMapsUrl?: string;
  googlePlaceId?: string;
  latitude?: number;
  longitude?: number;
  referenceListingCode?: string;
  listingCodes?: string[];
  photos?: string[];
  tags?: string[];
  sellerClientId?: string;
  sellerClientName?: string;
  createdAt?: string;
};

export type ApiGooglePlaceLookupResult = {
  placeId: string;
  displayName?: string;
  formattedAddress?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
};

export type ApiPropertyBlacklistIdentityType = 'KAEK' | 'GOOGLE_PLACE_ID' | 'INTERNAL_CODE';

export type ApiPropertyBlacklistEntry = {
  id: string;
  identityType: ApiPropertyBlacklistIdentityType;
  identityValue: string;
  reason?: string;
  createdAt?: string;
};

export type ApiClient = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  tags?: string[];
  groupIds?: string[];
  leadSource?: string;
  leadMetadata?: Record<string, string>;
  createdAt?: string;
};

export type ApiDeal = {
  id: string;
  clientId: string;
  clientName: string;
  propertyId: string;
  propertyTitle: string;
  status: 'DOCUMENTS_PHASE' | 'PROCESS_PHASE' | 'SETTLEMENT_PHASE' | 'COMPLETED' | 'CANCELLED';
  documentsPhase?: 'SELLER' | 'BUYER' | 'COMPLETE';
  clientLinkToken: string;
  buyerLinkToken?: string;
  sellerLinkToken?: string;
  publicRole?: 'BUYER' | 'SELLER';
  createdAt?: string;
  completedAt?: string;
};

export type ApiBuyerIndicationStatus =
  | 'SENT'
  | 'EXPIRED'
  | 'RENEWAL_REQUESTED'
  | 'BROKER_REVIEW'
  | 'APPROVED'
  | 'APPOINTMENT_BOOKED'
  | 'FOLLOW_UP_PENDING'
  | 'INTERESTED'
  | 'NOT_INTERESTED';

export type ApiBuyerGender = 'MALE' | 'FEMALE';
export type ApiBuyerActingMode = 'INDIVIDUAL' | 'REPRESENTING_OTHER';
export type ApiBrokerGender = 'MALE' | 'FEMALE';
export type ApiBrokerIdentityMode = 'SELF' | 'OFFICE';

export type ApiBuyerIndication = {
  id: string;
  clientId?: string;
  clientName?: string;
  propertyId: string;
  propertyTitle: string;
  propertyReferenceListingCode?: string;
  status: ApiBuyerIndicationStatus;
  buyerEmail: string;
  publicToken: string;
  expiresAt: string;
  sentAt: string;
  submittedAt?: string;
  renewalRequestedAt?: string;
  approvedAt?: string;
  appointmentBookedAt?: string;
  appointmentStartAt?: string;
  appointmentEndAt?: string;
  appointmentBrokerName?: string;
  followUpEmailSentAt?: string;
  interestResponseAt?: string;
  buyerInterestComment?: string;
  brokerName: string;
  brokerOffice: string;
  brokerGender?: ApiBrokerGender;
  brokerIdentityMode?: ApiBrokerIdentityMode;
  brokerCommissionPct: number;
  grossFeeWithVat: number;
  propertyArea?: number;
  propertyAddress: string;
  propertyRegion: string;
  propertyType: string;
  propertyValue: number;
  propertyMapsUrl: string;
  buyerFullName?: string;
  buyerGender?: ApiBuyerGender;
  buyerFatherName?: string;
  buyerIdNumber?: string;
  buyerTaxId?: string;
  buyerCity?: string;
  buyerStreet?: string;
  buyerStreetNumber?: string;
  buyerPhone?: string;
  includesThirdParty?: boolean;
  thirdPartyFullName?: string;
  thirdPartyIdNumber?: string;
  actingMode?: ApiBuyerActingMode;
  actingOnBehalfOf?: string;
  buyerSignature?: string;
  brokerSignature?: string;
  buyerTaxVerification?: ApiVerificationSummary;
  generatedDocumentText?: string;
  fixedDocumentCity: string;
  expired: boolean;
  renewalAllowed: boolean;
  reviewReady: boolean;
  appointmentBookingReady: boolean;
  interestResponsePending: boolean;
  dealReady: boolean;
};

export type ApiBuyerProfileLookupResult = {
  source: 'DATABASE' | string;
  buyerFullName?: string;
  buyerGender?: ApiBuyerGender;
  buyerFatherName?: string;
  buyerIdNumber?: string;
  buyerTaxId?: string;
  buyerCity?: string;
  buyerStreet?: string;
  buyerStreetNumber?: string;
  buyerPhone?: string;
};

export type ApiSellerListingAssignmentStatus =
  | 'SENT'
  | 'EXPIRED'
  | 'RENEWAL_REQUESTED'
  | 'BROKER_REVIEW'
  | 'APPROVED'
  | 'IMPORTED';

export type ApiSellerListingAssignmentDocumentType =
  | 'TITLE_DEED'
  | 'ENERGY_CERTIFICATE'
  | 'AUTHORIZATION';

export type ApiSellerListingAssignmentDocument = {
  id: string;
  documentType: ApiSellerListingAssignmentDocumentType;
  name: string;
  required: boolean;
  status: ApiDealDocumentStatus;
  fileUrl?: string;
  filePreviewUrl?: string;
  uploadedAt?: string;
  reviewerComment?: string;
  reviewerName?: string;
  reviewedAt?: string;
};

export type ApiSellerListingAssignment = {
  id: string;
  clientId?: string;
  clientName?: string;
  importedPropertyId?: string;
  importedPropertyTitle?: string;
  status: ApiSellerListingAssignmentStatus;
  sellerEmail: string;
  brokerCommissionPct: number;
  publicToken: string;
  expiresAt: string;
  sentAt: string;
  submittedAt?: string;
  approvedAt?: string;
  importedAt?: string;
  renewalRequestedAt?: string;
  propertyTitle?: string;
  propertyLocation?: string;
  propertyRegion?: string;
  propertyStreet?: string;
  propertyStreetNumber?: string;
  propertyType?: string;
  propertyIntent?: string;
  propertyFloor?: string;
  propertyPrice?: number;
  propertyArea?: number;
  listingUrl?: string;
  propertyMapsUrl?: string;
  propertyDescription?: string;
  propertyDefects?: string;
  sellerRejectsLoanBuyers?: boolean;
  importDraftTitle?: string;
  importDraftLocation?: string;
  importDraftType?: string;
  importDraftPrice?: number;
  importDraftKaek?: string;
  importDraftGoogleMapsUrl?: string;
  importDraftGooglePlaceId?: string;
  importDraftLatitude?: number;
  importDraftLongitude?: number;
  importDraftListingUrl?: string;
  importDraftReferenceListingCode?: string;
  importDraftListingCodes?: string[];
  importDraftDescription?: string;
  importDraftTags?: string[];
  importDraftSellerRejectsLoanBuyers?: boolean;
  importDraftStep?: string;
  importDraftSavedAt?: string;
  sellerFullName?: string;
  sellerPhone?: string;
  sellerGender?: ApiBuyerGender;
  sellerFatherName?: string;
  sellerIdNumber?: string;
  sellerTaxId?: string;
  sellerTaxIdCheckedOnGov?: boolean;
  sellerTaxIdCheckedAt?: string;
  sellerTaxVerification?: ApiVerificationSummary;
  sellerCity?: string;
  sellerStreet?: string;
  sellerStreetNumber?: string;
  actingMode?: ApiBuyerActingMode;
  actingOnBehalfOf?: string;
  actingAuthorityType?: string;
  sellerSignature?: string;
  brokerSignature?: string;
  grossFeeWithVat?: number;
  generatedDocumentText?: string;
  sellerNotes?: string;
  photoUrls?: string[];
  photoPreviewUrls?: string[];
  supportingDocuments?: ApiSellerListingAssignmentDocument[];
  tags?: string[];
  expired: boolean;
  renewalAllowed: boolean;
  reviewReady: boolean;
  imported: boolean;
};

export type ApiDealDocumentStatus = 'PENDING' | 'UPLOADED' | 'APPROVED' | 'REJECTED';

export type ApiVerificationSummary = {
  provider: string;
  status: 'VERIFIED' | 'REJECTED' | 'ERROR' | string;
  actorType?: 'PUBLIC_SIGNUP' | 'STAFF' | 'SYSTEM' | string;
  verifiedBusinessName?: string;
  verifiedGemiNumber?: string;
  verifiedTaxId?: string;
  providerReferenceId?: string;
  verifiedAt?: string;
};

export type ApiDealDocument = {
  id: string;
  name: string;
  category?: string;
  status: ApiDealDocumentStatus;
  partyRole?: 'BUYER' | 'SELLER';
  assignedRole?: ApiMemberRole;
  fileUrl?: string;
  uploadedAt?: string;
  reviewerComment?: string;
  reviewerName?: string;
  reviewedAt?: string;
};

export type ApiMemberDocument = {
  id: string;
  dealId: string;
  stageId: string;
  stageTitle: string;
  memberId: string;
  memberName: string;
  role: string;
  name: string;
  stageStatus?: 'LOCKED' | 'ACTIVE' | 'COMPLETED';
  uploadAllowed?: boolean;
  status: ApiDealDocumentStatus;
  fileUrl?: string;
  uploadedAt?: string;
  reviewerComment?: string;
  reviewerName?: string;
  reviewedAt?: string;
};

export type ApiUploadUrlResponse = {
  uploadUrl: string;
  fileUrl: string;
};

export type ApiUploadRequest = {
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
};

export type ApiMemberRole = 'LAWYER' | 'ENGINEER' | 'SURVEYOR' | 'NOTARY' | 'OTHER';

export type ApiDealMember = {
  id: string;
  dealId: string;
  teamId?: string;
  teamName?: string;
  role: ApiMemberRole;
  name: string;
  email?: string;
  phone?: string;
  linkToken: string;
  createdAt?: string;
};

export type ApiMemberTeam = {
  id: string;
  name: string;
  coverageAreas?: string[];
  createdAt?: string;
};

export type ApiTeamMember = {
  id: string;
  teamId?: string;
  teamName?: string;
  role: ApiMemberRole;
  professionalRoleId?: string;
  professionalRoleName?: string;
  name: string;
  email?: string;
  phone?: string;
  createdAt?: string;
};

export type ApiProcessTemplateTeamAssignment = {
  teamId: string;
  teamName: string;
  role: ApiMemberRole;
  partyRole?: 'BUYER' | 'SELLER';
  professionalRoleId?: string;
  professionalRoleName?: string;
  teamMemberId?: string;
  teamMemberName?: string;
};

export type ApiProfessionalRole = {
  id: string;
  code: string;
  label: string;
  system: boolean;
  legacyMemberRole?: ApiMemberRole;
  createdAt?: string;
};

export type ApiMemberTeamSuggestion = {
  id: string;
  name: string;
  coverageAreas?: string[];
  score: number;
};

export type ApiIntegrationProvider =
  | 'META_LEADS'
  | 'GOOGLE_LEADS'
  | 'EMAIL_GMAIL'
  | 'EMAIL_OUTLOOK'
  | 'EMAIL_FORWARDING';

export type ApiIntegrationStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
export type ApiIntegrationHealth = 'HEALTHY' | 'WARNING' | 'ERROR' | 'DISCONNECTED';

export type ApiIntegrationConnection = {
  provider: ApiIntegrationProvider;
  status: ApiIntegrationStatus;
  health: ApiIntegrationHealth;
  metadata?: Record<string, string>;
  connectedAt?: string;
  credentialsUpdatedAt?: string;
  lastSyncAt?: string;
  lastWebhookAt?: string;
  lastError?: string | null;
  lastErrorAt?: string | null;
  consecutiveFailureCount: number;
};

export type ApiAdminIntegrationConnection = {
  userId: string;
  userEmail: string;
  userName?: string | null;
  provider: ApiIntegrationProvider;
  status: ApiIntegrationStatus;
  health: ApiIntegrationHealth;
  connectedAt?: string;
  credentialsUpdatedAt?: string;
  lastSyncAt?: string;
  lastWebhookAt?: string;
  lastError?: string | null;
  lastErrorAt?: string | null;
  consecutiveFailureCount: number;
  metadata?: Record<string, string>;
};

export type ApiIntegrationDiagnosticSeverity = 'INFO' | 'WARNING' | 'ERROR';
export type ApiIntegrationDiagnosticEventType =
  | 'CONNECTED'
  | 'CREDENTIALS_UPDATED'
  | 'DISCONNECTED'
  | 'SYNC_SUCCESS'
  | 'SYNC_FAILURE'
  | 'WEBHOOK_RECEIVED'
  | 'WEBHOOK_FAILED'
  | 'WEBHOOK_PARSE_FAILED';

export type ApiIntegrationDiagnosticEvent = {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  provider: ApiIntegrationProvider;
  severity: ApiIntegrationDiagnosticSeverity;
  eventType: ApiIntegrationDiagnosticEventType;
  message: string;
  details?: Record<string, string>;
  createdAt: string;
};

export type ApiAdminIntegrationDiagnostics = {
  connections: ApiAdminIntegrationConnection[];
  recentEvents: ApiIntegrationDiagnosticEvent[];
};

export type ApiDealStageStatus = 'LOCKED' | 'ACTIVE' | 'COMPLETED';

export type ApiDealStage = {
  id: string;
  dealId: string;
  memberId?: string;
  memberName?: string;
  title: string;
  status: ApiDealStageStatus;
  partyRole?: 'BUYER' | 'SELLER';
  dependencies?: string[];
  requiredDocuments?: string[];
  deadline?: string;
  completedAt?: string;
  otpVerified: boolean;
  comment?: string;
};

export type ApiDashboardAnalytics = {
  avgDealDays: number;
  activeDeals: number;
  completedDeals: number;
  bottleneckStage?: string;
};

export type ApiEngagementVisitor = {
  id: string;
  alias: string;
  email?: string;
  phone?: string;
  visits: number;
  timeSpent: string;
  alsoViewed: string[];
};

export type ApiPropertyEngagement = {
  propertyId: string;
  totalViews: number;
  saves: number;
  inquiries: number;
  repeatVisitors: number;
  viewsOverTime: number[];
  visitors: ApiEngagementVisitor[];
};

export type ApiDealAnalytics = {
  dealId: string;
  totalDays: number;
  totalMinutes?: number;
  stageDurationsDays: Record<string, number>;
  stageDurationsMinutes?: Record<string, number>;
  slowestStage?: string;
  slowestStageMinutes?: number;
  fastestStage?: string;
  fastestStageMinutes?: number;
  memberAvgDays: Record<string, number>;
  memberAvgMinutes?: Record<string, number>;
};

export type ApiMatchProperty = {
  id: string;
  title: string;
  location: string;
  price: number;
  type: string;
  tags?: string[];
};

export type ApiMatchResult = {
  clientId: string;
  properties: ApiMatchProperty[];
};

export type ApiMatchDispatchResponse = {
  clientId: string;
  recipientEmail: string;
  matchedCount: number;
  sent: boolean;
};

export type ApiSubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
export type ApiUsageMetric = 'EMAILS' | 'SMS' | 'API_CALLS' | 'AI_REQUESTS';

export type ApiBillingPlan = {
  id?: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  monthlyPriceCents?: number | null;
  yearlyPriceCents?: number | null;
  stripeMonthlyPriceId?: string | null;
  stripeYearlyPriceId?: string | null;
  integrationsEnabled: boolean;
  aiEnabled: boolean;
  emailMonthlyLimit?: number | null;
  smsMonthlyLimit?: number | null;
  apiMonthlyLimit?: number | null;
  aiMonthlyLimit?: number | null;
  trialDays?: number | null;
  gracePeriodDays?: number | null;
  graceIntegrationsEnabled: boolean;
  graceAiEnabled: boolean;
  graceEmailEnabled: boolean;
  graceSmsEnabled: boolean;
  graceApiEnabled: boolean;
  active: boolean;
  purchasable: boolean;
  retiredAt?: string | null;
};

export type ApiUsageCounter = {
  metric: ApiUsageMetric;
  usedCount: number;
  limit?: number | null;
  unlimited: boolean;
  periodStart: string;
  periodEnd: string;
};

export type ApiBillingOverview = {
  subscriptionStatus: ApiSubscriptionStatus;
  startedAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string | null;
  gracePeriodEndsAt?: string | null;
  dunningState?: string | null;
  billingInterval?: 'monthly' | 'yearly' | string;
  catalogAmountCents?: number | null;
  effectiveAmountCents?: number | null;
  appliedCouponCode?: string | null;
  appliedDiscountPercent?: number | null;
  appliedCouponValidFrom?: string | null;
  appliedCouponValidUntil?: string | null;
  billingCustomerLinked?: boolean;
  integrationsEnabled: boolean;
  aiEnabled: boolean;
  emailAllowed: boolean;
  smsAllowed: boolean;
  apiAllowed: boolean;
  entitlementOverrideActive: boolean;
  entitlementOverrideValidUntil?: string | null;
  entitlementOverrideReason?: string | null;
  currentPlan: ApiBillingPlan;
  pendingChange?: ApiBillingSubscriptionScheduledChange | null;
  availablePlans: ApiBillingPlan[];
  usage: ApiUsageCounter[];
  invoices?: ApiInvoiceReference[];
  history?: ApiBillingSubscriptionHistory[];
};

export type ApiCurrentUser = {
  authenticated: boolean;
  id?: string;
  email?: string;
  name?: string;
  company?: string;
};

export type ApiInvoiceReference = {
  id: string;
  provider: string;
  providerInvoiceId: string;
  status: string;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  amountDueCents?: number | null;
  currency?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: string;
};

export type ApiBillingSubscriptionHistory = {
  id: string;
  planCode: string;
  planName?: string;
  status: ApiSubscriptionStatus;
  provider?: string;
  providerSubscriptionId?: string;
  providerPriceId?: string;
  startedAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string | null;
  gracePeriodEndsAt?: string | null;
  dunningState?: string | null;
  canceledAt?: string;
  changeSource?: string;
  changeReason?: string;
  createdAt?: string;
};

export type ApiBillingCheckoutSessionResponse = {
  sessionId: string;
  url: string;
};

export type ApiBillingCoupon = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  percentOff: number;
  applicablePlanCode?: string | null;
  active: boolean;
  validFrom?: string | null;
  validUntil?: string | null;
  maxRedemptions?: number | null;
  redemptionCount: number;
  createdAt?: string;
};

export type ApiBillingCouponPreview = {
  code: string;
  name: string;
  description?: string | null;
  percentOff: number;
  applicablePlanCode?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  maxRedemptions?: number | null;
  redemptionCount: number;
};

export type ApiBillingCouponCreatePayload = {
  code: string;
  name: string;
  description?: string;
  percentOff: number;
  applicablePlanCode?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  maxRedemptions?: number | null;
};

export type ApiBillingSubscriptionScheduledChange = {
  id: string;
  currentPlanCode: string;
  currentPlanName?: string;
  targetPlanCode: string;
  targetPlanName?: string;
  status: 'PENDING' | 'APPLIED' | 'CANCELED' | 'FAILED';
  effectiveAt?: string;
  appliedAt?: string;
  canceledAt?: string;
  failureReason?: string;
  lockedFeaturesAfterChange?: string[];
};

export type ApiBillingPlanUpsertPayload = {
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  monthlyPriceCents?: number | null;
  yearlyPriceCents?: number | null;
  stripeMonthlyPriceId?: string | null;
  stripeYearlyPriceId?: string | null;
  integrationsEnabled: boolean;
  aiEnabled: boolean;
  emailMonthlyLimit?: number | null;
  smsMonthlyLimit?: number | null;
  apiMonthlyLimit?: number | null;
  aiMonthlyLimit?: number | null;
  trialDays?: number | null;
  gracePeriodDays?: number | null;
  graceIntegrationsEnabled: boolean;
  graceAiEnabled: boolean;
  graceEmailEnabled: boolean;
  graceSmsEnabled: boolean;
  graceApiEnabled: boolean;
};

export type ApiBillingPlanScheduleUpdatePayload = ApiBillingPlanUpsertPayload & {
  effectiveAt: string;
};

export type ApiBillingPlanRetirementPayload = {
  effectiveAt: string;
};

export type ApiBillingPortalSessionResponse = {
  url: string;
};

export type ApiGroup = {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt?: string;
};

export type ApiDocumentTemplateItem = {
  name: string;
  description?: string;
  required?: boolean;
  partyRole?: 'BUYER' | 'SELLER';
  collectionPhase?: boolean;
};

export type ApiDocumentTemplate = {
  id: string;
  name: string;
  type: string;
  systemDefault: boolean;
  documents: ApiDocumentTemplateItem[];
  createdAt?: string;
};

export type ApiProcessTemplateStage = {
  title: string;
  role: 'LAWYER' | 'ENGINEER' | 'SURVEYOR' | 'NOTARY' | 'OTHER';
  professionalRoleId?: string;
  professionalRoleName?: string;
  partyRole?: 'BUYER' | 'SELLER';
  dependencies: string[];
  deadlineDays?: number;
  requiredDocuments?: string[];
};

export type ApiProcessTemplate = {
  id: string;
  name: string;
  type: string;
  systemDefault: boolean;
  stages: ApiProcessTemplateStage[];
  createdAt?: string;
};

export type ApiNotificationFeedItem = {
  id: string;
  dealId?: string;
  type: string;
  channel: string;
  message: string;
  sentAt: string;
  readAt?: string | null;
};

export type ApiOutboundEmailDelivery = {
  id: string;
  provider: string;
  source: string;
  deliveryKey: string;
  providerMessageId?: string | null;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'DEFERRED' | 'SOFT_BOUNCED' | 'HARD_BOUNCED' | 'FAILED';
  providerEventType?: string | null;
  failureReason?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  bouncedAt?: string | null;
  failedAt?: string | null;
  lastEventAt?: string | null;
  createdAt?: string | null;
};

export type ApiImportError = {
  rowNumber: number;
  code?: string;
  message: string;
};

export type ApiImportResponse = {
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errors: ApiImportError[];
};

type LoginResponse = { token: string };

export type ApiBrokerSignupState = {
  token: string;
  email: string;
  fullName: string;
  businessName: string;
  gemiNumber: string;
  taxId: string;
  phone: string;
  selectedPlanCode?: string;
  selectedBillingInterval?: 'monthly' | 'yearly' | string;
  selectedPlanName?: string;
  status: 'PENDING_VERIFICATION' | 'READY_FOR_CHECKOUT' | 'CHECKOUT_PENDING' | 'PAYMENT_CONFIRMED' | 'ACTIVATED' | 'FAILED';
  emailVerified: boolean;
  phoneVerified: boolean;
  businessVerified: boolean;
  businessVerificationSource?: string;
  businessVerificationStatus?: string;
  businessVerificationCheckedAt?: string;
  businessVerificationReference?: string;
  businessVerificationMessage?: string;
  businessVerification?: ApiVerificationSummary;
  verifiedBusinessName?: string;
  verifiedGemiNumber?: string;
  verifiedTaxId?: string;
  activated: boolean;
  checkoutStartedAt?: string;
  activatedAt?: string;
  createdAt?: string;
};

export type ApiBrokerSignupVerificationDispatch = {
  signup: ApiBrokerSignupState;
  debugCode?: string;
};

export type ApiBrokerSignupCatalog = {
  plans: ApiBillingPlan[];
};

export type ApiAdminPlanSummary = {
  code: string;
  name: string;
  subscriberCount: number;
  activeSubscriberCount: number;
};

export type ApiBillingUsageSafetyEvent = {
  id: string;
  userId: string;
  userEmail?: string;
  metric: ApiUsageMetric;
  eventType: 'WARNING' | 'BLOCKED';
  threshold: number;
  observedCount: number;
  windowStart: string;
  windowEnd: string;
  note?: string;
  createdAt: string;
};

export type ApiUnlimitedSafetySettings = {
  enabled: boolean;
  apiCallsWindowMinutes: number;
  apiCallsPerWindow: number;
  emailWindowMinutes: number;
  emailsPerWindow: number;
  smsWindowMinutes: number;
  smsPerWindow: number;
  aiWindowMinutes: number;
  aiRequestsPerWindow: number;
  warningThresholdPercent: number;
};

export type ApiAdminBillingDashboard = {
  totalBrokerUsers: number;
  totalAdminUsers: number;
  billingCustomersLinked: number;
  totalPlans: number;
  customPlanCount: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  pastDueSubscriptions: number;
  canceledSubscriptions: number;
  expiredSubscriptions: number;
  plans: ApiBillingPlan[];
  planSummaries: ApiAdminPlanSummary[];
  scheduledChanges: ApiBillingPlanScheduledChange[];
  recentSafetyEvents: ApiBillingUsageSafetyEvent[];
  recentEmailDeliveries: ApiOutboundEmailDelivery[];
  unlimitedSafetySettings: ApiUnlimitedSafetySettings;
};

export type ApiAdminBrokerSubscription = {
  subscriptionId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  company?: string;
  phone?: string;
  planCode?: string;
  planName?: string;
  subscriptionStatus: ApiSubscriptionStatus;
  dunningState?: string | null;
  provider?: string | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  billingCustomerLinked: boolean;
  billingInterval?: 'monthly' | 'yearly' | string;
  catalogAmountCents?: number | null;
  effectiveAmountCents?: number | null;
  appliedCouponCode?: string | null;
  appliedDiscountPercent?: number | null;
  startedAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string | null;
  gracePeriodEndsAt?: string | null;
  integrationsEnabled: boolean;
  aiEnabled: boolean;
  emailAllowed: boolean;
  smsAllowed: boolean;
  apiAllowed: boolean;
  entitlementOverrideActive: boolean;
  entitlementOverrideValidUntil?: string | null;
  entitlementOverrideReason?: string | null;
  overrideIntegrationsEnabled?: boolean | null;
  overrideAiEnabled?: boolean | null;
  overrideEmailEnabled?: boolean | null;
  overrideSmsEnabled?: boolean | null;
  overrideApiEnabled?: boolean | null;
};

export type ApiAdminSubscriptionSearchResponse = {
  totalCount: number;
  subscriptions: ApiAdminBrokerSubscription[];
};

export type ApiAdminSubscriptionPeriodExtensionPayload = {
  currentPeriodEnd: string;
  reason?: string;
};

export type ApiAdminSubscriptionGracePayload = {
  gracePeriodEndsAt: string;
  reason?: string;
};

export type ApiAdminSubscriptionEntitlementOverridePayload = {
  integrationsEnabled?: boolean | null;
  aiEnabled?: boolean | null;
  emailEnabled?: boolean | null;
  smsEnabled?: boolean | null;
  apiEnabled?: boolean | null;
  validUntil: string;
  reason?: string;
};

export type ApiBillingPlanScheduledChange = {
  id: string;
  planId: string;
  planCode: string;
  planName: string;
  action: 'UPDATE' | 'RETIRE';
  status: 'PENDING' | 'APPLIED' | 'FAILED' | 'CANCELED';
  effectiveAt: string;
  appliedAt?: string;
  failureReason?: string;
  createdAt?: string;
};

const apiErrorLabels: Record<string, string> = {
  BAD_REQUEST: 'Μη έγκυρο αίτημα.',
  VALIDATION_FAILED: 'Αποτυχία επικύρωσης στοιχείων.',
  UNAUTHORIZED: 'Δεν έχετε πρόσβαση. Συνδεθείτε ξανά.',
  FORBIDDEN: 'Δεν έχετε δικαίωμα για αυτή την ενέργεια.',
  NOT_FOUND: 'Δεν βρέθηκε το ζητούμενο στοιχείο.',
  CONFLICT: 'Υπάρχει σύγκρουση δεδομένων.',
  CLIENT_NOT_FOUND: 'Ο πελάτης δεν βρέθηκε.',
  PROPERTY_NOT_FOUND: 'Το ακίνητο δεν βρέθηκε.',
  PROPERTY_REFERENCE_IDENTIFIER_CONFLICT: 'Ο μοναδικός κωδικός αναφοράς του ακινήτου χρησιμοποιείται ήδη.',
  PROPERTY_IDENTITY_REQUIRED: 'Το ακίνητο χρειάζεται KAEK, Google Place ID ή internal property ID.',
  PROPERTY_KAEK_CONFLICT: 'Το KAEK ανήκει ήδη σε άλλο ακίνητο.',
  PROPERTY_GOOGLE_PLACE_ID_CONFLICT: 'Το Google Place ID ανήκει ήδη σε άλλο ακίνητο.',
  PROPERTY_BLACKLISTED: 'Το συγκεκριμένο property identity είναι blacklisted και δεν επιτρέπεται να χρησιμοποιηθεί.',
  GOOGLE_PLACE_LOOKUP_NOT_CONFIGURED: 'Δεν έχει ρυθμιστεί ακόμη η σύνδεση με Google Places.',
  GOOGLE_PLACE_LOOKUP_NO_MATCH: 'Δεν βρέθηκε Google place για την αναζήτηση.',
  DEAL_NOT_FOUND: 'Η συναλλαγή δεν βρέθηκε.',
  BUYER_INDICATION_NOT_FOUND: 'Η εντολή υπόδειξης δεν βρέθηκε.',
  SELLER_LISTING_ASSIGNMENT_NOT_FOUND: 'Η εντολή παραχώρησης δεν βρέθηκε.',
  DOCUMENT_NOT_FOUND: 'Το έγγραφο δεν βρέθηκε.',
  DOCUMENT_TEMPLATE_NOT_FOUND: 'Το καλούπι εγγράφων δεν βρέθηκε.',
  PROCESS_TEMPLATE_NOT_FOUND: 'Το καλούπι διαδικασίας δεν βρέθηκε.',
  STAGE_NOT_FOUND: 'Το στάδιο δεν βρέθηκε.',
  MEMBER_NOT_FOUND: 'Το μέλος δεν βρέθηκε.',
  MEMBER_DOCUMENT_NOT_FOUND: 'Το έγγραφο μέλους δεν βρέθηκε.',
  TEAM_NOT_FOUND: 'Η ομάδα δεν βρέθηκε.',
  TEAM_MEMBER_NOT_FOUND: 'Το μέλος ομάδας δεν βρέθηκε.',
  SYSTEM_TEMPLATE_MODIFICATION_NOT_ALLOWED: 'Τα system templates δεν μπορούν να τροποποιηθούν.',
  SYSTEM_TEMPLATE_DELETION_NOT_ALLOWED: 'Τα system templates δεν μπορούν να διαγραφούν.',
  TEAM_ALREADY_EXISTS: 'Υπάρχει ήδη ομάδα με αυτό το όνομα.',
  TEAM_ASSIGNED_TO_MEMBERS: 'Η ομάδα είναι ήδη ανατεθειμένη σε μέλη.',
  TEAM_MEMBER_NOT_IN_TEAM: 'Το μέλος δεν ανήκει στην ομάδα.',
  DEAL_NOT_IN_DOCUMENTS_PHASE: 'Η συναλλαγή δεν βρίσκεται στη φάση εγγράφων.',
  DEAL_NOT_IN_PROCESS_PHASE: 'Η συναλλαγή δεν βρίσκεται στη φάση διαδικασίας.',
  DEAL_NOT_IN_SETTLEMENT_PHASE: 'Η συναλλαγή δεν βρίσκεται στη φάση ηλεκτρονικής ολοκλήρωσης.',
  DEAL_MISSING_DOCUMENTS: 'Δεν υπάρχουν έγγραφα για αυτή τη συναλλαγή.',
  DOCUMENTS_NOT_APPROVED: 'Όλα τα έγγραφα πρέπει να εγκριθούν πρώτα.',
  DOCUMENTS_PHASE_INCOMPLETE: 'Δεν έχει ολοκληρωθεί η σωστή φάση συλλογής εγγράφων.',
  PAYMENT_PROOFS_INCOMPLETE: 'Τα αποδεικτικά πληρωμής πρέπει να ανέβουν και να εγκριθούν πριν την ολοκλήρωση.',
  DOCUMENT_ROLE_NOT_ALLOWED: 'Δεν επιτρέπεται η υποβολή εγγράφου για αυτόν τον ρόλο.',
  STAGE_DEPENDENCIES_INCOMPLETE: 'Δεν έχουν ολοκληρωθεί οι εξαρτήσεις του σταδίου.',
  STAGE_LOCKED: 'Το στάδιο είναι κλειδωμένο.',
  STAGE_REQUIRED_DOCUMENTS_MISSING: 'Λείπουν απαιτούμενα έγγραφα για το στάδιο.',
  INVALID_OTP: 'Μη έγκυρος κωδικός OTP.',
  MEMBER_HAS_NO_EMAIL: 'Το μέλος δεν έχει email.',
  MEMBER_HAS_NO_PHONE: 'Το μέλος δεν έχει τηλέφωνο.',
  CLIENT_HAS_NO_EMAIL: 'Ο πελάτης δεν έχει email.',
  DOCUMENT_HAS_NO_FILE: 'Το έγγραφο δεν έχει αρχείο.',
  BUYER_INDICATION_EXPIRED: 'Το link της εντολής υπόδειξης έχει λήξει.',
  BUYER_INDICATION_NOT_EXPIRED: 'Το link της εντολής υπόδειξης δεν έχει λήξει ακόμη.',
  BUYER_INDICATION_ALREADY_COMPLETED: 'Η εντολή υπόδειξης έχει ήδη ολοκληρωθεί.',
  BUYER_INDICATION_NOT_READY_FOR_REVIEW: 'Η εντολή υπόδειξης δεν είναι έτοιμη για έλεγχο.',
  BUYER_INDICATION_APPOINTMENT_CONFLICT: 'Υπάρχει ήδη άλλο ραντεβού σε εκείνη την ώρα για τον μεσίτη.',
  SELLER_LISTING_ASSIGNMENT_EXPIRED: 'Το link της εντολής παραχώρησης έχει λήξει.',
  SELLER_LISTING_ASSIGNMENT_NOT_EXPIRED: 'Το link της εντολής παραχώρησης δεν έχει λήξει ακόμη.',
  SELLER_LISTING_ASSIGNMENT_ALREADY_COMPLETED: 'Η εντολή παραχώρησης έχει ήδη ολοκληρωθεί.',
  SELLER_LISTING_ASSIGNMENT_NOT_READY_FOR_REVIEW: 'Η εντολή παραχώρησης δεν είναι έτοιμη για έλεγχο.',
  UNSUPPORTED_CHANNEL: 'Μη υποστηριζόμενο κανάλι ειδοποίησης.',
  BILLING_NOT_CONFIGURED: 'Το billing provider δεν έχει ρυθμιστεί ακόμη.',
  BILLING_PLAN_DOES_NOT_INCLUDE_AI: 'Το current plan δεν περιλαμβάνει AI features. Η εμπορική ενεργοποίηση των premium plans έρχεται σύντομα.',
  BILLING_PLAN_DOES_NOT_INCLUDE_INTEGRATIONS: 'Το current plan δεν περιλαμβάνει integrations. Η εμπορική ενεργοποίηση των premium plans έρχεται σύντομα.',
  BILLING_PLAN_DELETION_NOT_ALLOWED: 'Αυτό το plan δεν μπορεί να διαγραφεί από το admin UI.',
  BILLING_PLAN_IN_USE: 'Αυτό το plan δεν μπορεί να διαγραφεί γιατί χρησιμοποιείται ήδη σε subscriptions ή billing history.',
  BILLING_PLAN_PRICE_NOT_CONFIGURED: 'Δεν έχει ρυθμιστεί Stripe price για αυτό το plan.',
  BILLING_PLAN_SCHEDULE_INVALID_DATE: 'Η ημερομηνία έναρξης πρέπει να είναι στο μέλλον.',
  BILLING_PLAN_RETIREMENT_NO_FALLBACK: 'Δεν υπάρχει προηγούμενο ενεργό πλάνο για αυτόματη μεταφορά των χρηστών.',
  BILLING_PROVIDER_SYNC_FAILED: 'Αποτυχία συγχρονισμού της συνδρομής με τον billing provider.',
  BILLING_PORTAL_NOT_READY: 'Δεν υπάρχει ακόμη ενεργό billing customer για portal management.',
  BILLING_USAGE_LIMIT_EXCEEDED: 'Έχει εξαντληθεί το μηνιαίο usage limit του plan σας.',
  BILLING_USAGE_SAFETY_LIMIT_EXCEEDED: 'Η χρήση περιορίστηκε προσωρινά από τους fair-use μηχανισμούς προστασίας του Unlimited plan.',
  BILLING_FEATURE_NOT_AVAILABLE_FOR_SUBSCRIPTION_STATE: 'Το feature δεν είναι διαθέσιμο για την τρέχουσα κατάσταση της συνδρομής σας.',
  BILLING_WEBHOOK_INVALID_SIGNATURE: 'Μη έγκυρη υπογραφή billing webhook.',
  BROKER_DIRECT_REGISTRATION_DISABLED: 'Η άμεση δημιουργία broker λογαριασμού είναι απενεργοποιημένη. Χρησιμοποίησε το onboarding flow.',
  BROKER_ONBOARDING_NOT_FOUND: 'Το onboarding του broker δεν βρέθηκε.',
  BROKER_ONBOARDING_ALREADY_EXISTS: 'Υπάρχει ήδη ενεργό onboarding για αυτό το email.',
  BROKER_ONBOARDING_INVALID_VERIFICATION_CODE: 'Μη έγκυρος ή ληγμένος κωδικός επιβεβαίωσης.',
  BROKER_ONBOARDING_CHECKOUT_NOT_READY: 'Ολοκλήρωσε πρώτα email, τηλέφωνο και επιβεβαίωση επιχείρησης.',
  BROKER_ONBOARDING_ALREADY_ACTIVATED: 'Το onboarding έχει ήδη ενεργοποιηθεί.',
  EMAIL_ALREADY_REGISTERED: 'Το email είναι ήδη καταχωρημένο.',
  INVALID_CREDENTIALS: 'Λάθος στοιχεία σύνδεσης.',
  PASSWORD_RESET_INVALID_TOKEN: 'Το link επαναφοράς κωδικού δεν είναι έγκυρο ή έχει λήξει.',
};

export class ApiError extends Error {
  code?: string;
  details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

function storageKeyForAudience(audience: AuthAudience) {
  return audience === 'admin' ? ADMIN_TOKEN_STORAGE_KEY : BROKER_TOKEN_STORAGE_KEY;
}

function sessionStorageKeyForAudience(audience: AuthAudience) {
  return audience === 'admin' ? ADMIN_TOKEN_SESSION_STORAGE_KEY : BROKER_TOKEN_SESSION_STORAGE_KEY;
}

function getStoredToken(audience: AuthAudience = 'broker'): string | null {
  return window.localStorage.getItem(storageKeyForAudience(audience))
    ?? window.sessionStorage.getItem(sessionStorageKeyForAudience(audience));
}

function setStoredToken(token: string, audience: AuthAudience = 'broker', persist = true) {
  window.localStorage.removeItem(storageKeyForAudience(audience));
  window.sessionStorage.removeItem(sessionStorageKeyForAudience(audience));
  if (persist) {
    window.localStorage.setItem(storageKeyForAudience(audience), token);
    return;
  }
  window.sessionStorage.setItem(sessionStorageKeyForAudience(audience), token);
}

async function request<T>(
  path: string,
  options: {
    method?: HttpMethod;
    body?: unknown;
    isPublic?: boolean;
    tokenAudience?: AuthAudience;
  } = {},
): Promise<T> {
  if (DEMO_MODE) {
    return mockRequest<T>(path, options);
  }

  const isPublic = options.isPublic ?? false;
  const token = isPublic ? null : await ensureAuthenticated(options.tokenAudience ?? 'broker');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const text = await response.text();
    let code: string | undefined;
    let errorMessage = text || response.statusText;
    let details: unknown;
    try {
      const parsed = text ? (JSON.parse(text) as { code?: string; error?: string; message?: string; details?: unknown }) : undefined;
      if (parsed) {
        code = parsed.code;
        errorMessage = parsed.error ?? parsed.message ?? errorMessage;
        details = parsed.details;
      }
    } catch (error) {
      // Non-JSON error payloads are ignored.
    }
    const mappedMessage = code && apiErrorLabels[code] ? apiErrorLabels[code] : errorMessage;
    throw new ApiError(mappedMessage, code, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

async function requestBlob(
  path: string,
  options: {
    method?: HttpMethod;
    body?: unknown;
    isPublic?: boolean;
    tokenAudience?: AuthAudience;
  } = {},
): Promise<Blob> {
  if (DEMO_MODE) {
    return mockRequestBlob();
  }

  const isPublic = options.isPublic ?? false;
  const token = isPublic ? null : await ensureAuthenticated(options.tokenAudience ?? 'broker');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const text = await response.text();
    let code: string | undefined;
    let errorMessage = text || response.statusText;
    let details: unknown;
    try {
      const parsed = text ? (JSON.parse(text) as { code?: string; error?: string; message?: string; details?: unknown }) : undefined;
      if (parsed) {
        code = parsed.code;
        errorMessage = parsed.error ?? parsed.message ?? errorMessage;
        details = parsed.details;
      }
    } catch {
      // Non-JSON error payloads are ignored.
    }
    const mappedMessage = code && apiErrorLabels[code] ? apiErrorLabels[code] : errorMessage;
    throw new ApiError(mappedMessage, code, details);
  }

  return response.blob();
}

export async function ensureAuthenticated(audience: AuthAudience = 'broker'): Promise<string> {
  if (DEMO_MODE) {
    const existing = getStoredToken(audience);
    if (existing) return existing;
    throw new Error('Not authenticated');
  }
  const existing = getStoredToken(audience);
  if (existing) {
    return existing;
  }
  throw new Error('Not authenticated');
}

export async function login(email: string, password: string, rememberMe = true): Promise<string> {
  if (DEMO_MODE) {
    if (!email.trim() || !password.trim()) {
      throw new ApiError('Λάθος στοιχεία σύνδεσης.', 'INVALID_CREDENTIALS');
    }
    const token = getMockToken('broker');
    setStoredToken(token, 'broker', rememberMe);
    return token;
  }
  const response = await request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    isPublic: true,
    body: { email, password },
  });
  setStoredToken(response.token, 'broker', rememberMe);
  return response.token;
}

export async function loginAdmin(email: string, password: string, rememberMe = true): Promise<string> {
  if (DEMO_MODE) {
    if (!email.trim() || !password.trim()) {
      throw new ApiError('Λάθος στοιχεία σύνδεσης.', 'INVALID_CREDENTIALS');
    }
    const token = getMockToken('admin');
    setStoredToken(token, 'admin', rememberMe);
    return token;
  }
  const response = await request<LoginResponse>('/api/auth/admin/login', {
    method: 'POST',
    isPublic: true,
    body: { email, password },
  });
  setStoredToken(response.token, 'admin', rememberMe);
  return response.token;
}

export async function requestPasswordReset(email: string): Promise<void> {
  return request<void>('/api/auth/password-reset/request', {
    method: 'POST',
    isPublic: true,
    body: { email },
  });
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  return request<void>('/api/auth/password-reset/confirm', {
    method: 'POST',
    isPublic: true,
    body: { token, password },
  });
}

export async function getBrokerOnboardingCatalog(): Promise<ApiBrokerSignupCatalog> {
  return request<ApiBrokerSignupCatalog>('/api/auth/onboarding/plans', {
    isPublic: true,
  });
}

export async function startBrokerOnboarding(payload: {
  email: string;
  password: string;
  fullName: string;
  businessName: string;
  gemiNumber: string;
  taxId: string;
  phone: string;
  selectedPlanCode: string;
  selectedBillingInterval?: 'monthly' | 'yearly';
}): Promise<ApiBrokerSignupVerificationDispatch> {
  return request<ApiBrokerSignupVerificationDispatch>('/api/auth/onboarding/start', {
    method: 'POST',
    isPublic: true,
    body: payload,
  });
}

export async function getBrokerOnboardingState(token: string): Promise<ApiBrokerSignupState> {
  return request<ApiBrokerSignupState>(`/api/auth/onboarding/${token}`, {
    isPublic: true,
  });
}

export async function resendBrokerOnboardingEmailCode(token: string): Promise<ApiBrokerSignupVerificationDispatch> {
  return request<ApiBrokerSignupVerificationDispatch>(`/api/auth/onboarding/${token}/email/request`, {
    method: 'POST',
    isPublic: true,
  });
}

export async function verifyBrokerOnboardingEmail(token: string, code: string): Promise<ApiBrokerSignupVerificationDispatch> {
  return request<ApiBrokerSignupVerificationDispatch>(`/api/auth/onboarding/${token}/email/verify`, {
    method: 'POST',
    isPublic: true,
    body: { code },
  });
}

export async function requestBrokerOnboardingPhoneCode(token: string): Promise<ApiBrokerSignupVerificationDispatch> {
  return request<ApiBrokerSignupVerificationDispatch>(`/api/auth/onboarding/${token}/phone/request`, {
    method: 'POST',
    isPublic: true,
  });
}

export async function verifyBrokerOnboardingPhone(token: string, code: string): Promise<ApiBrokerSignupVerificationDispatch> {
  return request<ApiBrokerSignupVerificationDispatch>(`/api/auth/onboarding/${token}/phone/verify`, {
    method: 'POST',
    isPublic: true,
    body: { code },
  });
}

export async function verifyBrokerOnboardingBusiness(token: string): Promise<ApiBrokerSignupState> {
  return request<ApiBrokerSignupState>(`/api/auth/onboarding/${token}/business/verify`, {
    method: 'POST',
    isPublic: true,
  });
}

export async function createBrokerOnboardingCheckoutSession(
  token: string,
  payload: {
    planCode?: string;
    interval?: 'monthly' | 'yearly';
    couponCode?: string;
    successUrl?: string;
    cancelUrl?: string;
  },
): Promise<ApiBillingCheckoutSessionResponse> {
  return request<ApiBillingCheckoutSessionResponse>(`/api/auth/onboarding/${token}/checkout/session`, {
    method: 'POST',
    isPublic: true,
    body: payload,
  });
}

export function isAuthenticated(audience: AuthAudience = 'broker'): boolean {
  return Boolean(getStoredToken(audience));
}

export function getCurrentUserRole(audience: AuthAudience = 'broker'): string | null {
  const token = getStoredToken(audience);
  if (!token) {
    return null;
  }
  if (DEMO_MODE) {
    return audience === 'admin' ? 'ADMIN' : 'BROKER';
  }
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export async function listProperties(): Promise<ApiProperty[]> {
  return request<ApiProperty[]>('/api/properties');
}

export async function downloadPropertyAuditExport(
  propertyId: string,
  format: 'csv' | 'xlsx',
): Promise<Blob> {
  return requestBlob(`/api/properties/${propertyId}/audit-export?format=${format}`);
}

export async function updateProperty(
  propertyId: string,
  payload: {
    title: string;
    location: string;
    price: number;
    type: string;
    description?: string;
    listingUrl?: string;
    kaek?: string;
    googleMapsUrl?: string;
    googlePlaceId?: string;
    latitude?: number;
    longitude?: number;
    referenceListingCode?: string;
    listingCodes?: string[];
    photos?: string[];
    tags?: string[];
    sellerClientId?: string;
  },
): Promise<ApiProperty> {
  return request<ApiProperty>(`/api/properties/${propertyId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function searchGooglePlaces(query: string): Promise<ApiGooglePlaceLookupResult[]> {
  const params = new URLSearchParams({ query });
  return request<ApiGooglePlaceLookupResult[]>(`/api/properties/google-places/search?${params.toString()}`);
}

export async function listPropertyBlacklist(): Promise<ApiPropertyBlacklistEntry[]> {
  return request<ApiPropertyBlacklistEntry[]>('/api/properties/blacklist');
}

export async function createPropertyBlacklistEntry(payload: {
  identityType: ApiPropertyBlacklistIdentityType;
  identityValue: string;
  reason?: string;
}): Promise<ApiPropertyBlacklistEntry> {
  return request<ApiPropertyBlacklistEntry>('/api/properties/blacklist', {
    method: 'POST',
    body: payload,
  });
}

export async function deletePropertyBlacklistEntry(id: string): Promise<void> {
  return request<void>(`/api/properties/blacklist/${id}`, {
    method: 'DELETE',
  });
}

export async function listClients(): Promise<ApiClient[]> {
  return request<ApiClient[]>('/api/clients');
}

export async function createClient(payload: {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  tags?: string[];
  groupIds?: string[];
  leadSource?: string;
  leadMetadata?: Record<string, string>;
}): Promise<ApiClient> {
  return request<ApiClient>('/api/clients', {
    method: 'POST',
    body: payload,
  });
}

export async function updateClient(
  clientId: string,
  payload: {
    name: string;
    phone?: string;
    email?: string;
    notes?: string;
    tags?: string[];
    groupIds?: string[];
    leadSource?: string;
    leadMetadata?: Record<string, string>;
  },
): Promise<ApiClient> {
  return request<ApiClient>(`/api/clients/${clientId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function listDeals(): Promise<ApiDeal[]> {
  return request<ApiDeal[]>('/api/deals');
}

export async function getDeal(id: string): Promise<ApiDeal> {
  return request<ApiDeal>(`/api/deals/${id}`);
}

export async function downloadDealAuditExport(
  dealId: string,
  format: 'csv' | 'xlsx',
): Promise<Blob> {
  return requestBlob(`/api/deals/${dealId}/audit-export?format=${format}`);
}

export async function createDeal(payload: {
  clientId: string;
  propertyId: string;
  buyerIndicationId?: string;
  docTemplateId?: string;
  processTemplateId?: string;
  teamId?: string;
  teamIds?: string[];
  documents?: string[];
}): Promise<ApiDeal> {
  return request<ApiDeal>('/api/deals', {
    method: 'POST',
    body: payload,
  });
}

export async function listBuyerIndications(): Promise<ApiBuyerIndication[]> {
  return request<ApiBuyerIndication[]>('/api/buyer-indications');
}

export async function getBuyerIndication(id: string): Promise<ApiBuyerIndication> {
  return request<ApiBuyerIndication>(`/api/buyer-indications/${id}`);
}

export async function createBuyerIndication(payload: {
  clientId?: string;
  propertyId: string;
  buyerEmail: string;
  expiresInDays: number;
  brokerName: string;
  brokerOffice: string;
  brokerGender: ApiBrokerGender;
  brokerIdentityMode: ApiBrokerIdentityMode;
  brokerCommissionPct: number;
  propertyArea?: number;
  propertyAddress: string;
  propertyRegion: string;
  propertyType: string;
  propertyValue: number;
}): Promise<ApiBuyerIndication> {
  return request<ApiBuyerIndication>('/api/buyer-indications', {
    method: 'POST',
    body: payload,
  });
}

export async function listSellerListingAssignments(): Promise<ApiSellerListingAssignment[]> {
  return request<ApiSellerListingAssignment[]>('/api/seller-listing-assignments');
}

export async function getSellerListingAssignment(id: string): Promise<ApiSellerListingAssignment> {
  return request<ApiSellerListingAssignment>(`/api/seller-listing-assignments/${id}`);
}

export async function createSellerListingAssignment(payload: {
  sellerEmail: string;
  expiresInDays: number;
  brokerCommissionPct: number;
}): Promise<ApiSellerListingAssignment> {
  return request<ApiSellerListingAssignment>('/api/seller-listing-assignments', {
    method: 'POST',
    body: payload,
  });
}

export async function resendSellerListingAssignment(
  id: string,
  payload: { sellerEmail: string; expiresInDays: number; brokerCommissionPct: number },
): Promise<ApiSellerListingAssignment> {
  return request<ApiSellerListingAssignment>(`/api/seller-listing-assignments/${id}/resend`, {
    method: 'POST',
    body: payload,
  });
}

export async function approveSellerListingAssignment(
  id: string,
  payload: { reviewComment?: string; brokerSignature: string },
): Promise<ApiSellerListingAssignment> {
  return request<ApiSellerListingAssignment>(`/api/seller-listing-assignments/${id}/approve`, {
    method: 'POST',
    body: payload,
  });
}

export async function downloadSellerListingAssignmentDocument(id: string): Promise<Blob> {
  return requestBlob(`/api/seller-listing-assignments/${id}/document`);
}

export async function createSellerListingAssignmentPhotoUploadUrl(
  id: string,
  payload: ApiUploadRequest = {},
): Promise<ApiUploadUrlResponse> {
  return request<ApiUploadUrlResponse>(`/api/seller-listing-assignments/${id}/photos/upload-url`, {
    method: 'POST',
    body: payload,
  });
}

export async function attachSellerListingAssignmentPhoto(
  id: string,
  payload: { fileUrl: string },
): Promise<ApiSellerListingAssignment> {
  return request<ApiSellerListingAssignment>(`/api/seller-listing-assignments/${id}/photos`, {
    method: 'POST',
    body: payload,
  });
}

export async function reviewSellerListingAssignmentDocument(
  id: string,
  documentId: string,
  payload: { status: 'APPROVED' | 'REJECTED'; reviewerComment?: string },
): Promise<ApiSellerListingAssignment> {
  return request<ApiSellerListingAssignment>(`/api/seller-listing-assignments/${id}/documents/${documentId}/review`, {
    method: 'POST',
    body: payload,
  });
}

export async function importSellerListingAssignmentProperty(
  id: string,
  payload: {
    title: string;
    location: string;
    price: number;
    type: string;
    kaek?: string;
    googleMapsUrl?: string;
    googlePlaceId?: string;
    latitude?: number;
    longitude?: number;
    listingUrl?: string;
    referenceListingCode?: string;
    listingCodes?: string[];
    description?: string;
    photos?: string[];
    tags?: string[];
    sellerRejectsLoanBuyers?: boolean;
  },
): Promise<ApiProperty> {
  return request<ApiProperty>(`/api/seller-listing-assignments/${id}/import-property`, {
    method: 'POST',
    body: payload,
  });
}

export async function saveSellerListingAssignmentImportDraft(
  id: string,
  payload: {
    title?: string;
    location?: string;
    price?: number;
    type?: string;
    kaek?: string;
    googleMapsUrl?: string;
    googlePlaceId?: string;
    latitude?: number;
    longitude?: number;
    listingUrl?: string;
    kaek?: string;
    googleMapsUrl?: string;
    googlePlaceId?: string;
    latitude?: number;
    longitude?: number;
    referenceListingCode?: string;
    listingCodes?: string[];
    description?: string;
    tags?: string[];
    sellerRejectsLoanBuyers?: boolean;
    step: string;
  },
): Promise<ApiSellerListingAssignment> {
  return request<ApiSellerListingAssignment>(`/api/seller-listing-assignments/${id}/import-draft`, {
    method: 'POST',
    body: payload,
  });
}

export async function resendBuyerIndication(
  id: string,
  payload: { buyerEmail: string; expiresInDays: number },
): Promise<ApiBuyerIndication> {
  return request<ApiBuyerIndication>(`/api/buyer-indications/${id}/resend`, {
    method: 'POST',
    body: payload,
  });
}

export async function approveBuyerIndication(
  id: string,
  payload: { brokerSignature: string },
): Promise<ApiBuyerIndication> {
  return request<ApiBuyerIndication>(`/api/buyer-indications/${id}/approve`, {
    method: 'POST',
    body: payload,
  });
}

export async function bookBuyerIndicationAppointment(
  id: string,
  payload: { appointmentStartAt: string; appointmentEndAt: string; appointmentBrokerName: string },
): Promise<ApiBuyerIndication> {
  return request<ApiBuyerIndication>(`/api/buyer-indications/${id}/book-appointment`, {
    method: 'POST',
    body: payload,
  });
}

export async function downloadBuyerIndicationDocument(id: string): Promise<Blob> {
  return requestBlob(`/api/buyer-indications/${id}/document`);
}

export async function applyDealTeam(dealId: string, teamId: string): Promise<void> {
  await request<void>(`/api/deals/${dealId}/apply-team/${teamId}`, {
    method: 'POST',
    body: {},
  });
}

export async function startDealProcess(dealId: string): Promise<ApiDeal> {
  return request<ApiDeal>(`/api/deals/${dealId}/start-process`, {
    method: 'POST',
    body: {},
  });
}

export async function advanceDealDocumentsPhase(dealId: string): Promise<ApiDeal> {
  return request<ApiDeal>(`/api/deals/${dealId}/documents/advance`, {
    method: 'POST',
    body: {},
  });
}

export async function completeDeal(dealId: string): Promise<ApiDeal> {
  return request<ApiDeal>(`/api/deals/${dealId}/complete`, {
    method: 'POST',
    body: {},
  });
}

export async function listDealDocuments(dealId: string): Promise<ApiDealDocument[]> {
  return request<ApiDealDocument[]>(`/api/deals/${dealId}/documents`);
}

export async function assignDealDocumentRole(
  dealId: string,
  documentId: string,
  payload: { role: ApiMemberRole },
): Promise<ApiDealDocument> {
  return request<ApiDealDocument>(`/api/deals/${dealId}/documents/${documentId}/assign`, {
    method: 'POST',
    body: payload,
  });
}

export async function getDealDocumentDownloadUrl(
  dealId: string,
  documentId: string,
): Promise<{ downloadUrl: string }> {
  return request<{ downloadUrl: string }>(`/api/deals/${dealId}/documents/${documentId}/download-url`);
}

export async function listDealMembers(dealId: string): Promise<ApiDealMember[]> {
  return request<ApiDealMember[]>(`/api/members?dealId=${dealId}`);
}

export async function createDealMember(payload: {
  dealId: string;
  teamId?: string;
  role: ApiMemberRole;
  name: string;
  email?: string;
  phone?: string;
}): Promise<ApiDealMember> {
  return request<ApiDealMember>('/api/members', {
    method: 'POST',
    body: payload,
  });
}

export async function updateDealMember(
  memberId: string,
  payload: {
    teamId?: string;
    role: ApiMemberRole;
    name: string;
    email?: string;
    phone?: string;
  },
): Promise<ApiDealMember> {
  return request<ApiDealMember>(`/api/members/${memberId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteDealMember(memberId: string): Promise<void> {
  await request<void>(`/api/members/${memberId}`, {
    method: 'DELETE',
  });
}

export async function listMemberTeams(): Promise<ApiMemberTeam[]> {
  return request<ApiMemberTeam[]>('/api/member-teams');
}

export async function listTeamMembers(teamId?: string): Promise<ApiTeamMember[]> {
  const suffix = teamId ? `?teamId=${teamId}` : '';
  return request<ApiTeamMember[]>(`/api/team-members${suffix}`);
}

export async function createTeamMember(payload: {
  teamId?: string;
  role: ApiMemberRole;
  professionalRoleId?: string;
  name: string;
  email?: string;
  phone?: string;
}): Promise<ApiTeamMember> {
  return request<ApiTeamMember>('/api/team-members', {
    method: 'POST',
    body: payload,
  });
}

export async function updateTeamMember(
  teamMemberId: string,
  payload: {
    teamId?: string;
    role: ApiMemberRole;
    professionalRoleId?: string;
    name: string;
    email?: string;
    phone?: string;
  },
): Promise<ApiTeamMember> {
  return request<ApiTeamMember>(`/api/team-members/${teamMemberId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteTeamMember(teamMemberId: string): Promise<void> {
  await request<void>(`/api/team-members/${teamMemberId}`, {
    method: 'DELETE',
  });
}

export async function createMemberTeam(payload: { name: string; coverageAreas?: string[] }): Promise<ApiMemberTeam> {
  return request<ApiMemberTeam>('/api/member-teams', {
    method: 'POST',
    body: payload,
  });
}

export async function updateMemberTeam(
  teamId: string,
  payload: { name: string; coverageAreas?: string[] },
): Promise<ApiMemberTeam> {
  return request<ApiMemberTeam>(`/api/member-teams/${teamId}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function listProcessTemplateTeamAssignments(
  processTemplateId: string,
): Promise<ApiProcessTemplateTeamAssignment[]> {
  return request<ApiProcessTemplateTeamAssignment[]>(
    `/api/templates/processes/${processTemplateId}/team-assignments`,
  );
}

export async function saveProcessTemplateTeamAssignments(
  processTemplateId: string,
  payload: Array<{ teamId: string; role: ApiMemberRole; professionalRoleId?: string; partyRole?: 'BUYER' | 'SELLER'; teamMemberId?: string }>,
): Promise<ApiProcessTemplateTeamAssignment[]> {
  return request<ApiProcessTemplateTeamAssignment[]>(
    `/api/templates/processes/${processTemplateId}/team-assignments`,
    {
      method: 'POST',
      body: payload,
    },
  );
}

export async function listProfessionalRoles(): Promise<ApiProfessionalRole[]> {
  return request<ApiProfessionalRole[]>('/api/professional-roles');
}

export async function createProfessionalRole(payload: {
  code: string;
  label: string;
  legacyMemberRole?: ApiMemberRole;
}): Promise<ApiProfessionalRole> {
  return request<ApiProfessionalRole>('/api/professional-roles', {
    method: 'POST',
    body: payload,
  });
}

export async function updateProfessionalRole(
  id: string,
  payload: {
    code: string;
    label: string;
    legacyMemberRole?: ApiMemberRole;
  },
): Promise<ApiProfessionalRole> {
  return request<ApiProfessionalRole>(`/api/professional-roles/${id}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteProfessionalRole(id: string): Promise<void> {
  await request<void>(`/api/professional-roles/${id}`, {
    method: 'DELETE',
  });
}

export async function suggestMemberTeams(params: {
  location?: string;
  processTemplateId?: string;
}): Promise<ApiMemberTeamSuggestion[]> {
  const search = new URLSearchParams();
  if (params.location) search.set('location', params.location);
  if (params.processTemplateId) search.set('processTemplateId', params.processTemplateId);
  const suffix = search.toString();
  return request<ApiMemberTeamSuggestion[]>(`/api/member-teams/suggestions${suffix ? `?${suffix}` : ''}`);
}

export async function deleteMemberTeam(teamId: string): Promise<void> {
  await request<void>(`/api/member-teams/${teamId}`, {
    method: 'DELETE',
  });
}

export async function listDealStages(dealId: string): Promise<ApiDealStage[]> {
  return request<ApiDealStage[]>(`/api/stages/deal/${dealId}`);
}

export async function updateDealStageAssignee(
  dealId: string,
  stageId: string,
  payload: { memberId: string },
): Promise<ApiDealStage> {
  return request<ApiDealStage>(`/api/stages/deal/${dealId}/${stageId}/assignee`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateDealStageStatus(
  dealId: string,
  stageId: string,
  payload: { status: ApiDealStageStatus; comment?: string },
): Promise<ApiDealStage> {
  return request<ApiDealStage>(`/api/stages/deal/${dealId}/${stageId}/status`, {
    method: 'POST',
    body: payload,
  });
}

export async function updateDealStageDeadline(
  dealId: string,
  stageId: string,
  payload: { deadline: string },
): Promise<ApiDealStage> {
  return request<ApiDealStage>(`/api/stages/deal/${dealId}/${stageId}/deadline`, {
    method: 'POST',
    body: payload,
  });
}

export async function getDealAnalytics(dealId: string): Promise<ApiDealAnalytics> {
  return request<ApiDealAnalytics>(`/api/analytics/deal/${dealId}`);
}

export async function reviewDealDocument(
  dealId: string,
  documentId: string,
  payload: { status: ApiDealDocumentStatus; reviewerComment?: string },
): Promise<ApiDealDocument> {
  return request<ApiDealDocument>(`/api/deals/${dealId}/documents/${documentId}/review`, {
    method: 'POST',
    body: payload,
  });
}

export async function getPublicDeal(token: string): Promise<ApiDeal> {
  return request<ApiDeal>(`/api/public/deals/${token}`, { isPublic: true });
}

export async function getPublicBuyerIndication(token: string): Promise<ApiBuyerIndication> {
  return request<ApiBuyerIndication>(`/api/public/buyer-indications/${token}`, { isPublic: true });
}

export async function submitPublicBuyerIndication(
  token: string,
  payload: {
    buyerFullName: string;
    buyerGender: ApiBuyerGender;
    buyerFatherName: string;
    buyerIdNumber: string;
    buyerTaxId: string;
    buyerCity: string;
    buyerStreet: string;
    buyerStreetNumber: string;
    buyerPhone: string;
    includesThirdParty: boolean;
    thirdPartyFullName?: string;
    thirdPartyIdNumber?: string;
    actingMode: ApiBuyerActingMode;
    actingOnBehalfOf?: string;
    buyerSignature: string;
  },
): Promise<ApiBuyerIndication> {
  return request<ApiBuyerIndication>(`/api/public/buyer-indications/${token}/submit`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function lookupPublicBuyerProfileByTaxId(
  token: string,
  taxId: string,
): Promise<ApiBuyerProfileLookupResult> {
  const query = new URLSearchParams({ taxId }).toString();
  return request<ApiBuyerProfileLookupResult>(`/api/public/buyer-indications/${token}/buyer-profile?${query}`, {
    isPublic: true,
  });
}

export async function requestBuyerIndicationRenewal(token: string): Promise<{ requested: boolean }> {
  return request<{ requested: boolean }>(`/api/public/buyer-indications/${token}/request-renewal`, {
    method: 'POST',
    body: {},
    isPublic: true,
  });
}

export async function submitBuyerIndicationInterestResponse(
  token: string,
  payload: { interested: boolean; comment?: string },
): Promise<ApiBuyerIndication> {
  return request<ApiBuyerIndication>(`/api/public/buyer-indications/${token}/interest-response`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function getPublicSellerListingAssignment(token: string): Promise<ApiSellerListingAssignment> {
  return request<ApiSellerListingAssignment>(`/api/public/seller-listing-assignments/${token}`, { isPublic: true });
}

export async function submitPublicSellerListingAssignment(
  token: string,
  payload: {
    sellerFullName: string;
    sellerPhone: string;
    sellerGender: ApiBuyerGender;
    sellerFatherName: string;
    sellerIdNumber: string;
    sellerTaxId: string;
    sellerCity?: string;
    sellerStreet: string;
    sellerStreetNumber: string;
    actingMode: ApiBuyerActingMode;
    actingOnBehalfOf?: string;
    actingAuthorityType?: string;
    sellerSignature: string;
    propertyTitle: string;
    propertyRegion: string;
    propertyStreet: string;
    propertyStreetNumber: string;
    propertyType: string;
    propertyIntent: string;
    propertyFloor?: string;
    propertyPrice: number;
    propertyArea?: number;
    listingUrl?: string;
    propertyMapsUrl?: string;
    propertyDescription?: string;
    propertyDefects?: string;
    sellerNotes?: string;
    sellerRejectsLoanBuyers?: boolean;
  },
): Promise<ApiSellerListingAssignment> {
  return request<ApiSellerListingAssignment>(`/api/public/seller-listing-assignments/${token}/submit`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function requestSellerListingAssignmentRenewal(token: string): Promise<{ requested: boolean }> {
  return request<{ requested: boolean }>(`/api/public/seller-listing-assignments/${token}/request-renewal`, {
    method: 'POST',
    body: {},
    isPublic: true,
  });
}

export async function createPublicSellerListingPhotoUploadUrl(
  token: string,
  payload: { contentType?: string } = {},
): Promise<ApiUploadUrlResponse> {
  return request<ApiUploadUrlResponse>(`/api/public/seller-listing-assignments/${token}/photos/upload-url`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function attachPublicSellerListingPhoto(
  token: string,
  payload: { fileUrl: string },
): Promise<ApiSellerListingAssignment> {
  return request<ApiSellerListingAssignment>(`/api/public/seller-listing-assignments/${token}/photos`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function createPublicSellerListingDocumentUploadUrl(
  token: string,
  documentId: string,
  payload: ApiUploadRequest = {},
): Promise<ApiUploadUrlResponse> {
  return request<ApiUploadUrlResponse>(`/api/public/seller-listing-assignments/${token}/documents/${documentId}/upload-url`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function attachPublicSellerListingDocument(
  token: string,
  documentId: string,
  payload: { fileUrl: string },
): Promise<ApiSellerListingAssignment> {
  return request<ApiSellerListingAssignment>(`/api/public/seller-listing-assignments/${token}/documents/${documentId}`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function listPublicDealDocuments(token: string): Promise<ApiDealDocument[]> {
  return request<ApiDealDocument[]>(`/api/public/deals/${token}/documents`, { isPublic: true });
}

export async function createPublicDealDocumentUploadUrl(
  token: string,
  documentId: string,
  payload: ApiUploadRequest = {},
): Promise<ApiUploadUrlResponse> {
  return request<ApiUploadUrlResponse>(`/api/public/deals/${token}/documents/${documentId}/upload-url`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function completePublicDealDocumentUpload(
  token: string,
  documentId: string,
  payload: { fileUrl: string },
): Promise<ApiDealDocument> {
  return request<ApiDealDocument>(`/api/public/deals/${token}/documents/${documentId}/complete`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function getPublicDealDocumentDownloadUrl(
  token: string,
  documentId: string,
): Promise<{ downloadUrl: string }> {
  return request<{ downloadUrl: string }>(`/api/public/deals/${token}/documents/${documentId}/download-url`, {
    isPublic: true,
  });
}

export async function listPublicDealMembers(token: string): Promise<ApiDealMember[]> {
  return request<ApiDealMember[]>(`/api/public/deals/${token}/members`, { isPublic: true });
}

export async function getPublicMember(token: string): Promise<ApiDealMember> {
  return request<ApiDealMember>(`/api/public/members/${token}`, { isPublic: true });
}

export async function listPublicDealStages(token: string): Promise<ApiDealStage[]> {
  return request<ApiDealStage[]>(`/api/public/deals/${token}/stages`, { isPublic: true });
}

export async function listPublicMemberDocuments(token: string): Promise<ApiMemberDocument[]> {
  return request<ApiMemberDocument[]>(`/api/public/member-documents/${token}`, { isPublic: true });
}

export async function listPublicMemberSellerDocuments(token: string): Promise<ApiDealDocument[]> {
  return request<ApiDealDocument[]>(`/api/public/member-documents/${token}/seller-documents`, { isPublic: true });
}

export async function listPublicMemberRoleDocuments(token: string): Promise<ApiDealDocument[]> {
  return request<ApiDealDocument[]>(`/api/public/member-documents/${token}/role-documents`, { isPublic: true });
}

export async function createPublicMemberDocumentUploadUrl(
  token: string,
  documentId: string,
  payload: ApiUploadRequest = {},
): Promise<ApiUploadUrlResponse> {
  return request<ApiUploadUrlResponse>(`/api/public/member-documents/${token}/${documentId}/upload-url`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function completePublicMemberDocumentUpload(
  token: string,
  documentId: string,
  payload: { fileUrl: string },
): Promise<ApiMemberDocument> {
  return request<ApiMemberDocument>(`/api/public/member-documents/${token}/${documentId}/complete`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function getPublicMemberDocumentDownloadUrl(
  token: string,
  documentId: string,
): Promise<{ downloadUrl: string }> {
  return request<{ downloadUrl: string }>(`/api/public/member-documents/${token}/${documentId}/download-url`, {
    isPublic: true,
  });
}

export async function getPublicMemberSellerDocumentDownloadUrl(
  token: string,
  documentId: string,
): Promise<{ downloadUrl: string }> {
  return request<{ downloadUrl: string }>(`/api/public/member-documents/${token}/seller-documents/${documentId}/download-url`, {
    isPublic: true,
  });
}

export async function getPublicMemberRoleDocumentDownloadUrl(
  token: string,
  documentId: string,
): Promise<{ downloadUrl: string }> {
  return request<{ downloadUrl: string }>(`/api/public/member-documents/${token}/role-documents/${documentId}/download-url`, {
    isPublic: true,
  });
}

export async function reviewPublicMemberRoleDocument(
  token: string,
  documentId: string,
  payload: { status: ApiDealDocumentStatus; reviewerComment?: string },
): Promise<ApiDealDocument> {
  return request<ApiDealDocument>(`/api/public/member-documents/${token}/role-documents/${documentId}/review`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function sendPublicNudge(
  token: string,
  memberId: string,
  payload: { message: string },
): Promise<{ sent: boolean }> {
  return request<{ sent: boolean }>(`/api/public/notifications/nudge/${token}/${memberId}`, {
    method: 'POST',
    body: payload,
    isPublic: true,
  });
}

export async function listClientGroups(): Promise<ApiGroup[]> {
  return request<ApiGroup[]>('/api/groups/clients');
}

export async function createClientGroup(payload: {
  name: string;
  filters?: Record<string, unknown>;
}): Promise<ApiGroup> {
  return request<ApiGroup>('/api/groups/clients', {
    method: 'POST',
    body: payload,
  });
}

export async function listPropertyGroups(): Promise<ApiGroup[]> {
  return request<ApiGroup[]>('/api/groups/properties');
}

export async function createPropertyGroup(payload: {
  name: string;
  filters?: Record<string, unknown>;
}): Promise<ApiGroup> {
  return request<ApiGroup>('/api/groups/properties', {
    method: 'POST',
    body: payload,
  });
}

export async function listDocumentTemplates(): Promise<ApiDocumentTemplate[]> {
  return request<ApiDocumentTemplate[]>('/api/templates/documents');
}

export async function createDocumentTemplate(payload: {
  name: string;
  type: string;
  documents: ApiDocumentTemplateItem[];
}): Promise<ApiDocumentTemplate> {
  return request<ApiDocumentTemplate>('/api/templates/documents', {
    method: 'POST',
    body: payload,
  });
}

export async function updateDocumentTemplate(
  id: string,
  payload: {
    name: string;
    type: string;
    documents: ApiDocumentTemplateItem[];
  },
): Promise<ApiDocumentTemplate> {
  return request<ApiDocumentTemplate>(`/api/templates/documents/${id}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteDocumentTemplate(id: string): Promise<void> {
  await request<void>(`/api/templates/documents/${id}`, {
    method: 'DELETE',
  });
}

export async function listProcessTemplates(): Promise<ApiProcessTemplate[]> {
  return request<ApiProcessTemplate[]>('/api/templates/processes');
}

export async function createProcessTemplate(payload: {
  name: string;
  type: string;
  stages: ApiProcessTemplateStage[];
}): Promise<ApiProcessTemplate> {
  return request<ApiProcessTemplate>('/api/templates/processes', {
    method: 'POST',
    body: payload,
  });
}

export async function updateProcessTemplate(
  id: string,
  payload: {
    name: string;
    type: string;
    stages: ApiProcessTemplateStage[];
  },
): Promise<ApiProcessTemplate> {
  return request<ApiProcessTemplate>(`/api/templates/processes/${id}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteProcessTemplate(id: string): Promise<void> {
  await request<void>(`/api/templates/processes/${id}`, {
    method: 'DELETE',
  });
}

export async function listNotificationFeed(): Promise<ApiNotificationFeedItem[]> {
  return request<ApiNotificationFeedItem[]>('/api/notifications');
}

export async function sendBrokerNudge(payload: {
  dealId: string;
  memberId: string;
  message: string;
  channel?: 'email' | 'sms' | 'whatsapp';
}): Promise<{ sent: boolean }> {
  return request<{ sent: boolean }>('/api/notifications/nudge', {
    method: 'POST',
    body: payload,
  });
}

export async function listDealMemberDocuments(dealId: string): Promise<ApiMemberDocument[]> {
  return request<ApiMemberDocument[]>(`/api/member-documents/deal/${dealId}`);
}

export async function reviewDealMemberDocument(
  dealId: string,
  documentId: string,
  payload: { status: ApiDealDocumentStatus; reviewerComment?: string },
): Promise<ApiMemberDocument> {
  return request<ApiMemberDocument>(`/api/member-documents/deal/${dealId}/${documentId}/review`, {
    method: 'POST',
    body: payload,
  });
}

export async function getDealMemberDocumentDownloadUrl(
  dealId: string,
  documentId: string,
): Promise<{ downloadUrl: string }> {
  return request<{ downloadUrl: string }>(`/api/member-documents/deal/${dealId}/${documentId}/download-url`);
}

export async function markNotificationFeedReadAll(): Promise<{ updated: number }> {
  return request<{ updated: number }>('/api/notifications/read-all', {
    method: 'POST',
    body: {},
  });
}

export async function getDashboardAnalytics(): Promise<ApiDashboardAnalytics> {
  return request<ApiDashboardAnalytics>('/api/analytics/dashboard');
}

export async function listPropertyEngagement(): Promise<ApiPropertyEngagement[]> {
  return request<ApiPropertyEngagement[]>('/api/engagement/properties');
}

export async function autoMatchClient(clientId: string): Promise<ApiMatchResult> {
  return request<ApiMatchResult>(`/api/matching/clients/${clientId}/auto`);
}

export async function matchProperties(filters: {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  type?: string;
}): Promise<ApiMatchProperty[]> {
  return request<ApiMatchProperty[]>('/api/matching/properties', {
    method: 'POST',
    body: filters,
  });
}

export async function sendMatchSuggestions(
  clientId: string,
  filters: {
    location?: string;
    minPrice?: number;
    maxPrice?: number;
    type?: string;
  },
): Promise<ApiMatchDispatchResponse> {
  return request<ApiMatchDispatchResponse>(`/api/matching/clients/${clientId}/send-suggestions`, {
    method: 'POST',
    body: filters,
  });
}

export async function listIntegrations(): Promise<ApiIntegrationConnection[]> {
  return request<ApiIntegrationConnection[]>('/api/integrations');
}

export async function connectIntegration(
  provider: ApiIntegrationProvider,
  payload: { accessToken?: string; refreshToken?: string; metadata?: Record<string, string> },
): Promise<ApiIntegrationConnection> {
  return request<ApiIntegrationConnection>(`/api/integrations/${provider}/connect`, {
    method: 'POST',
    body: payload,
  });
}

export async function disconnectIntegration(
  provider: ApiIntegrationProvider,
  reason?: string,
): Promise<ApiIntegrationConnection> {
  return request<ApiIntegrationConnection>(`/api/integrations/${provider}/disconnect`, {
    method: 'POST',
    body: { reason },
  });
}

export async function getAdminIntegrationDiagnostics(): Promise<ApiAdminIntegrationDiagnostics> {
  return request<ApiAdminIntegrationDiagnostics>('/api/integrations/admin/diagnostics', {
    tokenAudience: 'admin',
  });
}

export async function getBillingOverview(): Promise<ApiBillingOverview> {
  return request<ApiBillingOverview>('/api/billing/overview');
}

export async function getCurrentUser(): Promise<ApiCurrentUser> {
  return request<ApiCurrentUser>('/api/me');
}

export async function listBillingPlans(): Promise<ApiBillingPlan[]> {
  return request<ApiBillingPlan[]>('/api/billing/plans');
}

export async function createBillingCheckoutSession(
  payload: {
    planCode: string;
    interval?: 'monthly' | 'yearly';
    couponCode?: string;
    successUrl?: string;
    cancelUrl?: string;
  },
): Promise<ApiBillingCheckoutSessionResponse> {
  return request<ApiBillingCheckoutSessionResponse>('/api/billing/checkout/session', {
    method: 'POST',
    body: payload,
  });
}

export async function listBillingCoupons(): Promise<ApiBillingCoupon[]> {
  return request<ApiBillingCoupon[]>('/api/billing/admin/coupons', {
    tokenAudience: 'admin',
  });
}

export async function createBillingCoupon(
  payload: ApiBillingCouponCreatePayload,
): Promise<ApiBillingCoupon> {
  return request<ApiBillingCoupon>('/api/billing/admin/coupons', {
    method: 'POST',
    body: payload,
    tokenAudience: 'admin',
  });
}

export async function previewBillingCoupon(
  code: string,
  planCode?: string,
): Promise<ApiBillingCouponPreview> {
  const params = new URLSearchParams({ code });
  if (planCode) {
    params.set('planCode', planCode);
  }
  return request<ApiBillingCouponPreview>(`/api/billing/coupons/preview?${params.toString()}`, {
    isPublic: true,
  });
}

export async function scheduleBillingSubscriptionDowngrade(
  payload: { planCode: string },
): Promise<ApiBillingSubscriptionScheduledChange> {
  return request<ApiBillingSubscriptionScheduledChange>('/api/billing/change-plan/schedule', {
    method: 'POST',
    body: payload,
  });
}

export async function createBillingPlan(payload: ApiBillingPlanUpsertPayload): Promise<ApiBillingPlan> {
  return request<ApiBillingPlan>('/api/billing/admin/plans', {
    method: 'POST',
    body: payload,
    tokenAudience: 'admin',
  });
}

export async function updateBillingPlan(planId: string, payload: ApiBillingPlanUpsertPayload): Promise<ApiBillingPlan> {
  return request<ApiBillingPlan>(`/api/billing/admin/plans/${planId}`, {
    method: 'PUT',
    body: payload,
    tokenAudience: 'admin',
  });
}

export async function deleteBillingPlan(planId: string): Promise<void> {
  await request<void>(`/api/billing/admin/plans/${planId}`, {
    method: 'DELETE',
    tokenAudience: 'admin',
  });
}

export async function scheduleBillingPlanUpdate(
  planId: string,
  payload: ApiBillingPlanScheduleUpdatePayload,
): Promise<ApiBillingPlanScheduledChange> {
  return request<ApiBillingPlanScheduledChange>(`/api/billing/admin/plans/${planId}/schedule-update`, {
    method: 'POST',
    body: payload,
    tokenAudience: 'admin',
  });
}

export async function scheduleBillingPlanRetirement(
  planId: string,
  payload: ApiBillingPlanRetirementPayload,
): Promise<ApiBillingPlanScheduledChange> {
  return request<ApiBillingPlanScheduledChange>(`/api/billing/admin/plans/${planId}/schedule-retirement`, {
    method: 'POST',
    body: payload,
    tokenAudience: 'admin',
  });
}

export async function getAdminBillingDashboard(): Promise<ApiAdminBillingDashboard> {
  return request<ApiAdminBillingDashboard>('/api/billing/admin/dashboard', {
    tokenAudience: 'admin',
  });
}

export async function searchAdminSubscriptions(params: {
  query?: string;
  planCode?: string;
  status?: string;
  dunningState?: string;
} = {}): Promise<ApiAdminSubscriptionSearchResponse> {
  const search = new URLSearchParams();
  if (params.query) search.set('query', params.query);
  if (params.planCode) search.set('planCode', params.planCode);
  if (params.status) search.set('status', params.status);
  if (params.dunningState) search.set('dunningState', params.dunningState);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return request<ApiAdminSubscriptionSearchResponse>(`/api/billing/admin/subscriptions${suffix}`, {
    tokenAudience: 'admin',
  });
}

export async function updateUnlimitedSafetySettings(
  payload: ApiUnlimitedSafetySettings,
): Promise<ApiUnlimitedSafetySettings> {
  return request<ApiUnlimitedSafetySettings>('/api/billing/admin/settings/unlimited-safety', {
    method: 'POST',
    body: payload,
    tokenAudience: 'admin',
  });
}

export async function extendAdminSubscriptionPeriod(
  subscriptionId: string,
  payload: ApiAdminSubscriptionPeriodExtensionPayload,
): Promise<ApiAdminBrokerSubscription> {
  return request<ApiAdminBrokerSubscription>(`/api/billing/admin/subscriptions/${subscriptionId}/extend-period`, {
    method: 'POST',
    body: payload,
    tokenAudience: 'admin',
  });
}

export async function grantAdminSubscriptionGrace(
  subscriptionId: string,
  payload: ApiAdminSubscriptionGracePayload,
): Promise<ApiAdminBrokerSubscription> {
  return request<ApiAdminBrokerSubscription>(`/api/billing/admin/subscriptions/${subscriptionId}/grant-grace`, {
    method: 'POST',
    body: payload,
    tokenAudience: 'admin',
  });
}

export async function upsertAdminEntitlementOverride(
  subscriptionId: string,
  payload: ApiAdminSubscriptionEntitlementOverridePayload,
): Promise<ApiAdminBrokerSubscription> {
  return request<ApiAdminBrokerSubscription>(`/api/billing/admin/subscriptions/${subscriptionId}/entitlement-override`, {
    method: 'POST',
    body: payload,
    tokenAudience: 'admin',
  });
}

export async function revokeAdminEntitlementOverride(subscriptionId: string): Promise<ApiAdminBrokerSubscription> {
  return request<ApiAdminBrokerSubscription>(`/api/billing/admin/subscriptions/${subscriptionId}/entitlement-override/revoke`, {
    method: 'POST',
    tokenAudience: 'admin',
  });
}

export async function createBillingPortalSession(): Promise<ApiBillingPortalSessionResponse> {
  return request<ApiBillingPortalSessionResponse>('/api/billing/portal/session', {
    method: 'POST',
  });
}

async function uploadCsv(path: string, file: File): Promise<ApiImportResponse> {
  if (DEMO_MODE) {
    return mockUploadCsv();
  }

  const token = await ensureAuthenticated();
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status} on ${path}: ${text || response.statusText}`);
  }

  return (await response.json()) as ApiImportResponse;
}

export async function importPropertiesCsv(file: File): Promise<ApiImportResponse> {
  return uploadCsv('/api/properties/import/csv', file);
}

export async function importClientsCsv(
  file: File,
  options?: { leadOnly?: boolean },
): Promise<ApiImportResponse> {
  const query = options?.leadOnly ? '?leadOnly=true' : '';
  return uploadCsv(`/api/clients/import/csv${query}`, file);
}

export function clearStoredToken(audience: AuthAudience = 'broker') {
  window.localStorage.removeItem(storageKeyForAudience(audience));
  window.sessionStorage.removeItem(sessionStorageKeyForAudience(audience));
}

export { DEMO_MODE as FRONTEND_DEMO_MODE, isMockUploadUrl };

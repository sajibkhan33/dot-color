import {
    CompanyProfile,
    ProductItem,
    Customer,
    Supplier,
    SalesInvoice,
    PurchaseOrder,
    AccountingTransaction,
    Quotation,
    StockMovement,
    StaffMember,
    AuditLogEntry,
} from '../types';

export const INITIAL_COMPANY_PROFILE: CompanyProfile = {
    name: 'Dot Color Communication',
    nameBn: "Dot Color",
    tagline: 'YOUR VISION, OUR CREATION!',
    taglineBn: "Print, ,    !",
    category: 'Printing, Packaging, Advertising & Brand Promotions',
    showTagline: false,
    showCategory: false,
    experienceYears: 6,
    phone: '01730581687',
    emails: ['info.dotcolor@gmail.com'],
    facebook: 'dotcolorcommunication.official',
    factoryAddress: 'Nazir Ahmed Chowdhury Road Raja Pukur By lane, G A Bhaban Mat, Chattogram, Bangladesh.',
    officeAddress: 'Nazir Ahmed Chowdhury Road Raja Pukur By lane, G A Bhaban Mat, Chattogram, Bangladesh.',
    currency: 'BDT',
    currencySymbol: "Tk",
    vatTaxNumber: 'BIN: 004829104-0503',
    incomeTaxRate: 0,
    tradeLicense: 'TRAD/DSCC/012948/2021',
    website: 'www.dotcolorcommunication.com',
    bankName: 'BRAC Bank PLC',
    bankAccount: '1501204892314001',
    bankBranch: 'Agrabad Branch, Chattogram',
    routingNumber: '060150341',
    bkashNagadNumber: '01846100900, 01756007600',
    bankingNotes: 'Clients can transfer invoices via BRAC Bank, bKash Merchant, or Cash counters.',
    // Factory Details
    factoryUnitBadge: 'DIGITAL PRINTING & FABRICATION UNIT',
    factoryName: 'DotColor Production & Printing Plant',
    factoryNameBn: "Dot Color   Print",
    factoryDescription: 'Equipped with high-resolution large-format solvent, eco-solvent, UV flatbed printers, laser cutting & CNC machines.',
    factoryPhone: '01846100900, 01756007600',
    // Corporate Office Details
    officeUnitBadge: 'CORPORATE HEAD OFFICE & SUPPORT CENTER',
    officeName: 'DotColor Corporate Office',
    officeNameBn: "Dot Color",
    officeDescription: 'Client consultation desk, creative graphic design studio, accounts & billing desk, and client support desk.',
    officePhone: '01846100900, 01756007600',
    // Services Section
    servicesSectionTitle: 'Our Specialized Service Capabilities',
    servicesSectionTitleBn: "Dot Color",
    servicesSectionSubtitle: 'End-to-end digital printing, 3D signage, corporate promotional merchandise, offset packaging & branding solutions.',
    servicesSectionSubtitleBn: "+      Print, ,",
    servicesCapabilities: [
        {
            id: 'srv-1',
            titleEn: 'Digital Printing',
            titleBn: "Print",
            iconName: 'Printer',
            descEn: 'Large format solvent/eco-solvent PVC flex, backlit banners, vinyl stickers, frosted film, rollup standees, x-banners, mesh banners.',
            descBn: "-   ,  ,   ,    - Print\u0964",
            color: 'amber',
        },
        {
            id: 'srv-2',
            titleEn: 'Sign Making & Lettering',
            titleBn: "",
            iconName: 'Layers',
            descEn: '3D acrylic LED letter signage, SS steel letter sign, neon flex lights, ACP facade board, rooftop billboards, directional boards.',
            descBn: ",   ,      \u0964",
            color: 'blue',
        },
        {
            id: 'srv-3',
            titleEn: 'Branded Promotional Gifts',
            titleBn: "",
            iconName: 'Gift',
            descEn: 'Customized leather notebooks, metal executive pens, ceramic mugs, wooden/acrylic crests, cotton polo shirts, custom flash drives, gift hampers.',
            descBn: ",  ,   Print,    , -    \u0964",
            color: 'emerald',
        },
        {
            id: 'srv-4',
            titleEn: 'Printing & Packaging',
            titleBn: "Print",
            iconName: 'Boxes',
            descEn: 'Brochures, product catalogues, corporate profiles, luxury packaging boxes, paper shopping bags, hangtags, stickers & label rolls.',
            descBn: ",  ,  ,         \u0964",
            color: 'purple',
        },
        {
            id: 'srv-5',
            titleEn: 'Graphic Design',
            titleBn: "",
            iconName: 'Palette',
            descEn: 'Complete brand identity design, logo creation, packaging dieline design, 3D exhibition booth mockup, advertising creatives.',
            descBn: ",  ,  -      \u0964",
            color: 'rose',
        },
        {
            id: 'srv-6',
            titleEn: 'Exhibition & Pavilions',
            titleBn: "",
            iconName: 'Sparkles',
            descEn: 'Custom wooden expo stalls, modular aluminum trade booths, stage backdrop design, display kiosk setups.',
            descBn: "\u0964",
            color: 'indigo',
        },
        {
            id: 'srv-7',
            titleEn: 'Events Management',
            titleBn: "",
            iconName: 'Calendar',
            descEn: 'Corporate product launch ceremonies, dealer meets, gala dinners, conferences with full audiovisual, trussing & staging.',
            descBn: ",   ,       \u0964",
            color: 'cyan',
        },
        {
            id: 'srv-8',
            titleEn: 'Venue Sourcing & Protocol',
            titleBn: "",
            iconName: 'Building2',
            descEn: 'Sourcing 5-star hotel banquet halls, convention centers, VIP protocol coordination, stage set and security planning in Chattogram.',
            descBn: ",       \u0964",
            color: 'teal',
        },
    ],
    customPremises: [],
    // Footer & Branding Defaults
    footerBrandText: 'DotColorCommunication Sales, POS & ERP',
    footerCopyrightText: '© 2026',
    footerPoweredByText: 'BD HOSTT',
    footerPoweredByUrl: 'https://www.bdhost.com',
    footerHotline: '01846100900',
    footerShowPoweredBy: true,
};

// All operational data now loaded directly from MongoDB database
export const INITIAL_PRODUCTS: ProductItem[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_SUPPLIERS: Supplier[] = [];

export const INITIAL_INVOICES: SalesInvoice[] = [];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [];

export const INITIAL_TRANSACTIONS: AccountingTransaction[] = [];

export const INITIAL_QUOTATIONS: Quotation[] = [];

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [];

export const INITIAL_STAFF_MEMBERS: StaffMember[] = [
    {
        id: 'staff-1791359602009',
        name: 'Super Admin',
        nameBn: 'সুপার এডমিন',
        role: 'Super Admin',
        roleBn: 'সিস্টেম সুপার এডমিন',
        location: 'Both',
        phone: '01846100900',
        email: 'bdhostterp@gmail.com',
        password: '100826',
        avatarColor: 'bg-blue-600',
        customRoleId: 'role-superadmin',
        isActive: true,
    },
    
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];


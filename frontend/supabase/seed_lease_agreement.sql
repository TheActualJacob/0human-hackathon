-- Seed an example England & Wales Assured Shorthold Tenancy agreement
-- into the special_terms field for any leases that currently have none.
--
-- Run this once in the Supabase SQL editor (or via `supabase db push`).
-- The landlord can then edit the text per-lease from the Leases page in the dashboard.
--
-- After saving, the WhatsApp agent will automatically include the agreement
-- text in its system prompt when talking to tenants on that lease.

UPDATE leases
SET special_terms = $agreement$
ASSURED SHORTHOLD TENANCY AGREEMENT
(England & Wales — Housing Act 1988 as amended by the Housing Act 1996)

PARTIES
- Landlord: [Landlord Full Name]
- Tenant(s): [Tenant Full Name(s)]
- Property: [Full Property Address including postcode]

TERM
- Tenancy Type: Assured Shorthold Tenancy (AST)
- Start Date: [DD Month YYYY]
- End Date: [DD Month YYYY] (fixed term of [X] months)
- After the fixed term: The tenancy continues as a statutory periodic tenancy on a month-to-month basis unless either party serves valid notice.

RENT
- Monthly Rent: £[Amount]
- Due Date: Payable in advance on the [Day, e.g. 1st] of each calendar month
- Payment Method: Bank transfer to [Sort Code / Account Number]
- Late Payment: Rent unpaid after [14] days is considered in arrears. Charges may apply in accordance with the Tenant Fees Act 2019.

DEPOSIT
- Deposit Amount: £[Amount] (equivalent to [X] weeks' rent)
- Deposit Scheme: [e.g. Deposit Protection Service (DPS) / Tenancy Deposit Scheme (TDS) / mydeposits]
- Scheme Reference: [Reference Number]
- The deposit is protected within 30 days of receipt as required by law.
- Deductions may only be made for unpaid rent, damage beyond fair wear and tear, or breach of tenancy obligations.

TENANT OBLIGATIONS
1. Pay rent on the due date each month without reminder.
2. Keep the property in a clean and tidy condition throughout the tenancy.
3. Report any damage, disrepair, or maintenance issues to the landlord promptly and in writing.
4. Not sublet, assign, or take in lodgers without the landlord's prior written consent.
5. Not make any alterations, redecoration, or improvements without prior written consent.
6. Allow the landlord or their agents access to inspect or carry out repairs on giving 24 hours' written notice (except in genuine emergencies).
7. Not cause or permit any nuisance, noise, or annoyance to neighbouring properties.
8. Use the property as a private residential dwelling only — no business use without consent.
9. Not keep pets without prior written consent.
10. Comply with all terms of any superior lease or building management rules that apply.
11. Return the property at the end of the tenancy in the same condition as at the start, subject to fair wear and tear.
12. Ensure all rubbish is disposed of properly on the designated collection days.

LANDLORD OBLIGATIONS
1. Allow the tenant quiet enjoyment of the property throughout the tenancy.
2. Keep the structure and exterior of the property in good repair (Landlord and Tenant Act 1985, s.11).
3. Keep all installations for the supply of water, gas, electricity, and sanitation in repair and proper working order.
4. Arrange an annual Gas Safety check by a Gas Safe registered engineer and provide a copy of the certificate to the tenant.
5. Ensure a valid Energy Performance Certificate (EPC) is provided and the property meets the minimum energy efficiency standard.
6. Ensure a valid Electrical Installation Condition Report (EICR) is in place and share it with the tenant.
7. Fit working smoke alarms on every floor and a carbon monoxide detector in rooms with solid fuel appliances.
8. Respond to emergency repairs within 24 hours.
9. Respond to routine repair requests within 28 days.
10. Give proper statutory notice before any rent increase (minimum 1 month written notice).

NOTICE PERIODS
- To end the tenancy, the tenant must give a minimum of [1 month / the equivalent of one rental period] written notice, ending on the last day of a rental period.
- The landlord may end the tenancy only by serving a valid Section 8 or Section 21 notice in accordance with the Housing Act 1988 and any subsequent amendments.
- Section 21 Notice: Minimum 2 months' notice. Cannot be served in the first 4 months of the original fixed term.
- Section 8 Notice: Minimum 14 days' notice for rent arrears grounds (Grounds 8, 10, 11).

PERMITTED PAYMENTS (Tenant Fees Act 2019)
The following are the only payments the tenant is required to make:
- Rent
- Refundable tenancy deposit (capped at 5 weeks' rent where annual rent is under £50,000)
- Holding deposit (capped at 1 week's rent, refundable)
- Payments for default by the tenant (e.g. lost keys — reasonable cost only)
- Changes to the tenancy requested by the tenant (capped at £50 or reasonable cost)

UTILITIES & COUNCIL TAX
- The tenant is responsible for: electricity, gas, water, broadband, TV licence, and council tax unless otherwise agreed in writing.
- [Note any utilities included in the rent, e.g. water rates]

SPECIAL CONDITIONS
[Add any additional agreed terms here. Examples:]
- [Pets: One [breed/type] permitted, subject to an additional deposit of £[X]]
- [Parking: One parking space allocated at [location]]
- [Garden: Tenant responsible for maintaining lawn and borders]
- [Smoking: Not permitted anywhere in the property]

GOVERNING LAW
This agreement is governed by the laws of England & Wales.

SIGNATURES
Landlord: _________________________ Date: _____________
Tenant: __________________________ Date: _____________
$agreement$
WHERE special_terms IS NULL OR special_terms = '';

Homed — App Plan
Oct 18, 2026 · @Kevin Jiang
The big idea
Hoos Housing (working name; Homed is the alternative) helps UVA students find housing, starting with first-years choosing their second-year home, on or off Grounds, by ranking every option on price, walk time to their own classes, and how nice the place is.
That framing is the key design decision. All first-years must live on Grounds, and those rooms are assigned at random, so first-years have no say in this year's housing. What they do decide, under heavy pressure, is next year: off-Grounds leases start getting signed in September and October of first year, often with people they met weeks earlier.
The app wins by making that early, high-stakes decision calmer and better informed: one place to see everything, a ranking tuned to each student, and tools for deciding as a group.
Who it's for and what it fixes
The launch user is a UVA first-year (about 4,000 a year) picking second-year housing with friends. Third- and fourth-years and graduate and PhD students join at the fall 2027 launch, since they search every year too. Secondary users are roommates, parents (who often pay), and later, landlords listing units.
Problem first-years have
What the app does about it
Pressure to sign in Sept–Oct before they know the market
Shows how much inventory is still open and what it costs, so students can see when waiting is safe
Listings are scattered across the UVA Off-Grounds site, Apartments.com, landlord sites and group chats
One searchable map of on- and off-Grounds options
They don't know Charlottesville yet, and first-years can't have a car on Grounds
Real walk times to their own classes, not "0.7 miles from UVA"
Hard to compare the true cost per person
All-in monthly cost per person: rent, utilities, parking, furniture, lease length
Deciding as a group of 3–6 is messy
Shared shortlist, voting, per-person budgets, merged class schedules
It's their first lease ever
Plain-language lease checklist and a pointer to UVA Student Legal Services before signing
MVP features
The first version ships nine features; everything else waits until students are using it.
1. Map + list search of every option near Grounds: off-Grounds apartments and houses, plus UVA's upperclass on-Grounds options (residential colleges, language houses, upperclass apartments).
2. Best Match ranking that balances price, location and looks, with sliders for each student's priorities (next section).
3. My Classes: add your schedule and every listing shows your weekly walking time to class.
4. Group mode: invite roommates, build one shortlist, vote, set each person's budget, and merge everyone's class schedules into one commute score.
5. True cost per person: rent split by bedroom, plus utilities, internet, parking and furniture, for 12-month vs academic-year leases.
6. Listing pages with photos, floor plans, bed-to-bath ratio, lease dates, and walk times to student landmarks (the Corner, the Lawn, Clemons, Newcomb, the AFC, grocery).
7. Alerts for new listings, price drops and "only a few units left" in saved buildings.
8. Compare side by side: pull up 2–4 saved places in columns (cost per person, walk times, bed/bath, lease terms, photos) with the better value in each row highlighted.
9. Match mode: swipe through places one at a time in Best Match order. Right-swipes go to your shortlist; in group mode, a place everyone swipes right on becomes a match.
After the MVP: in-app applications (next section), verified student reviews, summer and study-abroad sublets, roommate matching, a lease-reading assistant, tour booking, and a landlord dashboard.
Apply in the app
Students can apply to apartments and houses without leaving the app: fill out one profile, apply alone or with friends, and send it to several places at once.
1. One reusable profile, like the Common App for housing: contact info, student status, income or guarantor details, rental history, references and ID check. Filled once, reused everywhere.
2. Group applications: the group leader picks the place and floor plan. Each roommate gets an invite to fill in their own part, and each guarantor (often a parent) gets a separate link to sign. The leader sees who's done and who's holding things up.
3. Batch apply: a group or solo student applies to up to 3 places at once, ranked by preference. When one approves, the app prompts them to withdraw the rest.
4. Fees and deposits paid in the app and split per person, with every charge shown before paying.
5. Status tracker: submitted → under review → approved, waitlisted or denied → lease sent → signed, with alerts at each step.
6. Lease signing by e-signature, after the lease checklist and a nudge to have UVA Student Legal Services review it.
Landlords receive applications in their dashboard, or as a PDF by email if they aren't on the app yet. Credit and background checks run through a tenant-screening partner, so the app never stores credit reports.
Rules to build in from day one:
• Fee limits: Virginia caps nonrefundable application fees at $50, plus the landlord's actual third-party screening costs; landlords may also take a refundable application deposit. A revised version of that law takes effect July 1, 2027, right before launch, so have a lawyer check the flow against it.
• Batch costs add up: applying to 3 places means 3 fees per person, so the app shows the group's total before anyone submits.
• Applying is not signing: the app says plainly that an application can be withdrawn but a signed lease is binding.
• Privacy inside groups: roommates see only "done / not done" for each other, never income, SSNs or documents. Sensitive files are encrypted and deleted after the decision.
Phasing: profiles, group applications and batch apply ship at the fall 2027 launch, with landlords taking payment themselves. In-app payments, screening and e-signature follow once enough landlords are on board.
Best Match score
Every listing gets a 0–100 score per student: a weighted blend of price, location and looks, after hard filters remove anything that can't work (over max budget, wrong bedroom count, lease dates that don't fit).
\text{BestMatch} = w_{price} \cdot P + w_{location} \cdot L + w_{looks} \cdot A, \quad w_{price} + w_{location} + w_{looks} = 1
Default weights are 40 / 40 / 20. Students change them with three presets ("Budget first", "Close to class", "Nicest place") or sliders.
Sub-score
What it measures
How v1 computes it
Price (P)
All-in monthly cost per person against the student's budget, plus value vs similar units
100 at or under 85% of budget, falling to 0 at 100%; small bonus when $/bedroom beats the neighborhood median
Location (L)
Weekly walking time to the student's classes, plus chosen extras (gym, the Corner, grocery)
100 when the average walk is 5 min or less, falling to 0 at 30 min; bus time used if faster
Looks (A)
How nice the unit and building are
v1: year built or renovated, plus student swipe ratings of real photos. v2: a vision model that tags updated kitchens, natural light, finishes
Two trust rules: listings shown only with architectural renderings (common for buildings still under construction) get a "renderings only" badge and no photo-based looks score, and paid placement never changes the score.
Every card shows a one-line "why" (for example "$40 under budget · 9 min to your classes · renovated 2024") so the ranking never feels like a black box.
The score powers two ways to browse: side-by-side comparison for students who want to judge for themselves, and swipe-style Match mode for students who would rather let the app pick and just react.
My Classes: housing near your classes
Students add their classes and every listing is re-ranked by real walking minutes to those buildings, weighted by how often each class meets.
The catch: in October of first year, students don't know next year's schedule. So My Classes has two modes:
• Major mode (default for first-years): pick your school or intended major and the app uses the buildings that major's second-year courses met in over past semesters (Engineering → Thornton Hall and nearby E-School buildings; Commerce prospects → Rouss & Robertson; Nursing → Claude Moore Nursing).
• Schedule mode: enter course numbers (e.g. APMA 2120) or import a schedule; the app looks up each section's days, times and building. Used for current schedules, and again in spring once next fall's courses are posted.
How it works under the hood:
1. Map each UVA academic building to an entrance coordinate (about 100 buildings, entered once and checked by hand).
2. Precompute a walking-time matrix from every listing to every building on the OpenStreetMap pedestrian network. With ~100 buildings, this is small and refreshes nightly.
3. For each student, sum walk minutes across their weekly meetings, and show "your week: 2 h 10 min walking" plus the walk to their earliest class.
4. For listings farther out, compare against bus time on UVA and city routes and use whichever is faster.
Example: VERVE Charlottesville is a 1,332-bed building going up at 100 Stadium Road, at the corner of Jefferson Park Avenue, slated for summer 2027. For an engineering student it should land near the top on location. Its leasing site lists 2027–28 studios from about $1,910/month, so a budget-first student would see it fall on price. That trade-off, made visible, is the whole point of the app.
Student-specific filters
These filters reflect how UVA students actually choose housing; the first six ship in the MVP.
Filter
Why it matters for UVA students
Max all-in cost per person
Rent alone hides utilities, internet and parking
Unit size matches group size
A group of 4 needs exactly 4 bedrooms, not "2–5 BR"
Private bathroom (1:1 bed:bath)
One of the most-requested features in student buildings
Lease type: individual vs joint
Individual (by-the-bed) leases protect you if a roommate leaves
Lease term and start date
12-month vs academic-year; does it start in time for August move-in?
Study-abroad friendly
Subletting allowed, or a semester-only option
Furnished
Most second-years don't own furniture yet
Utilities and internet included
Simpler budgeting, fewer bills to split
On a bus route
Matters for places past JPA, Fontaine or Barracks Road
Parking available and its cost
Second-years start bringing cars; parking near Grounds is scarce and expensive
In-unit laundry, dishwasher, AC
Charlottesville is hot in August and September
Noise level: quiet vs social
Tagged from student reviews, e.g. close to Rugby Road vs a quiet side street
Late-night walk home
Lit main-road routes to Grounds and the Corner
Pets allowed
Small set of buildings; worth surfacing
Accessibility
Elevator, ground-floor units, step-free entrance
No guarantor or SSN needed
Key for international students without US credit
Amenity building
Gym, study rooms, rooftop: people weigh these against walking time
Upperclass and grad students get a few more: walk time to their own school (the Health System, Law, Darden, Batten), studios and 1-bedrooms with no roommates, units for couples or families, and quiet, grad-heavy buildings.
Accommodation-friendly
Each listing gets an "Accommodation-friendly" badge built from facts a student can check, not a landlord's yes/no. Landlords are already legally required to consider reasonable accommodations, so the useful question is how ready the place is and how smoothly requests go.
What the app shows
How it's sourced
Physical access: step-free entrance, elevator, ground-floor units, wide doorways, roll-in shower, grab bars
Landlord checklist, confirmed by photos
Sensory features: flashing door and smoke alarms, quiet units away from noise
Landlord checklist
How to request an accommodation: named contact, written process, typical response time
Landlord profile
How past requests went
Student reviews with an optional "accommodation request" rating
Assistance animal policy: service animals and emotional support animals, with no pet fees for either
Landlord profile
Kitchen access and private bathroom (common medical needs)
Floor plan data
Gender-inclusive units and roommate matching
Landlord profile and group mode
Religious needs: walking distance to places of worship, kosher or halal kitchen setups
Map layer and landlord checklist
On-Grounds options link to UVA's Student Disability Access Center housing page, which handles accommodation requests for UVA housing; students must request those every year, and an approval doesn't guarantee an on-Grounds spot. Disability information is never required, never shown to roommates, and never shared with landlords unless the student sends it.
Where the data comes from
Data is the hardest part of this app, so v1 starts with about 50 properties closest to Grounds, entered and verified by hand, then grows through partnerships and landlord self-listing rather than scraping.
Data
Source
How to get it
Off-Grounds listings
UVA Off-Grounds Housing site (run by Off Campus Partners), landlord and complex websites
Manual entry for v1; ask about a data partnership; free landlord self-listing portal
Floor plans and live rents for large complexes
Each complex's own leasing site
Manual for v1; landlord feed later
On-Grounds upperclass options
UVA Housing & Residence Life
Curated by hand each year: rates, eligibility, application dates
Class meeting times and rooms
Lou's List, which mines SIS every 6 hours; or SIS directly
Ask Prof. Bloomfield about access before using it
Building locations
OpenStreetMap, checked against UVA's classroom list
One-time entry of ~100 buildings
Walking and bus times
OpenStreetMap routing (OSRM or Valhalla); bus schedules from UVA and city transit
Self-hosted routing, nightly precompute
Reviews and real photos
UVA students
Verified with a @virginia.edu email
Every listing carries a "last verified" date; anything not confirmed in 14 days is dimmed.
Tech stack and architecture
Build web-first on Supabase, then add a mobile app on the same backend; one developer can ship the MVP this way.
• Backend: Supabase (Postgres with PostGIS for distance queries, built-in auth, photo storage, edge functions). The free tier covers an MVP, and Supabase is already connected here, so I can set up the schema when you're ready.
• Web first: Next.js. Students share listings as links in group chats, and parents use laptops, so the web app comes first.
• Mobile: React Native (Expo) on the same backend, for push alerts and a better map.
• Maps: Mapbox. Walk times: OSRM self-hosted on OpenStreetMap, so there is no per-request cost.
• Sign-in: restricted to @virginia.edu emails, which keeps reviews and groups UVA-only.
Walk times and rankings are computed ahead of time, so the apps only read results and stay fast.
Data model
Thirteen core tables in Postgres cover the MVP, plus five for applications and accessibility; locations are PostGIS points so distance queries stay fast.
Table
Key fields
users
email (@virginia.edu), class year, school or intended major, budget, score weights
groups, group_members
group name, members, per-person budget, shared shortlist
properties
name, address, location point, on_grounds flag, year built/renovated, landlord, amenities
floor_plans
property, beds, baths, sq ft, rent per person, lease start/end, lease type, furnished, utilities included, units available, last verified
photos
property or floor plan, url, is_rendering, looks rating
buildings
UVA building code, name, entrance point
sections
term, course number, days, start/end time, building
user_schedules
user, section (or major-mode building set)
walk_times
property, building, walk minutes, bus minutes (precomputed nightly)
saves_votes
user or group, floor plan, vote, note
reviews
property, user, ratings (noise, maintenance, landlord responsiveness, value), text
alerts
user, saved search or property, trigger type
applicant_profiles
user, contact, student status, guarantor contact, rental history, references (sensitive fields encrypted)
applications
user or group, floor plan, batch rank, status, fees shown, submitted and decided dates
application_members
application, roommate or guarantor, invite status, done flag
application_documents
member, encrypted file, delete-after date
accessibility
property, features checklist, accommodation contact and process, assistance-animal policy, gender-inclusive units
Build roadmap
The real launch target is the fall 2027 lease rush, when the Class of 2031 arrives; the months before are for validating, building and a spring beta.
Start validating this week: today's first-years are in the middle of the rush, so it's the best moment to interview them about what's hard. The gate numbers are suggested targets; adjust them once interviews show how big the pull is.
Launch and growth at UVA
The launch has to land before the lease rush, which means students should hear about the app in their first three weeks on Grounds.
• Seed through first-year halls: RAs, hall group chats, and a 2-minute demo at hall meetings (check Housing & Residence Life's rules on flyers and promotion first).
• Partner with student groups: Student Council has historically run campaigns against signing too early, which matches the app's message.
• Student media: the Cavalier Daily and WUVA cover the lease rush every fall.
• Parents: parent Facebook groups and orientation; parents often pay and want a clear cost comparison.
• Word of mouth by design: group mode means every user invites 3–5 roommates.
• Business model: free for students forever. Revenue later from landlord featured listings and lead fees, clearly labeled and never allowed to change the Best Match score.
• Expansion: once it works for first-years, open it to third- and fourth-years and graduate and PhD students at the fall 2027 launch, then to other college towns. Homed works at any school; Hoos Housing is UVA-only.
Risks and open questions
The biggest risk is UVA policy: the university has committed to requiring first- and second-years to live on Grounds, with new second-year beds targeted for fall 2027. Serving every class year and grad students, and listing on-Grounds options from day one, keeps the app useful either way.
Risk
Why it matters
Mitigation
Second-year on-Grounds requirement
Shrinks the off-Grounds market for first-years
Cover on-Grounds options and the HRL timeline; expand to all class years early
Data access
Scraping listing sites breaks their terms
Partnerships, landlord self-listing, manual entry for v1
Stale listings
Students lose trust fast if units are gone
"Last verified" dates; landlords confirm availability weekly
Fair housing law
Some filters and roommate preferences can cross legal lines
No filters on protected classes; get a lawyer's review before launch
Fake or unfair reviews
Damages trust and invites landlord complaints
UVA-email verification, moderation, landlord right to reply
Renderings vs reality
New buildings market with renderings
"Renderings only" badge, no looks score until real photos exist
Seasonality
Usage peaks Sept–Nov, then drops
Sublets, spring re-searches and upperclass moves fill the year
UVA trademarks
"Hoos", "Wahoos" and UVA logos may need licensing
Check with UVA trademark licensing before picking the final name
Sensitive applicant data
IDs, income documents and SSNs make the app a target
Screening partner holds credit data; encrypt files; delete after the decision; security review before launch
Application law
Virginia caps fees, and a revised rule takes effect July 1, 2027
Show every fee up front; a lawyer reviews the flow before launch
Landlord adoption
Applications only work if landlords accept them
PDF-by-email fallback; start with 5–10 large complexes near Grounds
Open questions and decisions so far:
[ ] Second-year on-Grounds requirement: expected to start around fall 2027, but no public start date found yet. Confirm with Housing & Residence Life.
[ ] Listing data partnership with Off Campus Partners and the Off-Grounds Housing office: ask during Phase 0.
[x] Class data: use Lou's List or SIS (confirm terms with Prof. Bloomfield).
[x] Score vs comparison: both. Side-by-side compare plus a swipe Match mode, each driven by the Best Match score.
[ ] Final name: Hoos Housing or Homed. Homed avoids UVA trademark questions and fits grad students and other schools.
Sources
• UVA Housing: Incoming First-Year Housing FAQ
• UVA Housing: Incoming First-Year Undergraduates
• UVA Student Affairs: Decisions about Second-Year Housing
• C-VILLE Weekly: UVA second-year housing and the Verve site plan
• REBusiness Online: VERVE Charlottesville groundbreaking
• VERVE Charlottesville floor plans
• UVA Off-Grounds Housing site
• UVA Library: Lou's List
• Code of Virginia § 55.1-1203: application fees and deposits
• UVA Student Disability Access Center: Housing Accommodations

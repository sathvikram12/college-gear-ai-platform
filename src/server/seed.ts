import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  quizzes, quizQuestions, quizOptions, interviewCategories, interviewQuestions, placementStats,
  announcements, news, resources, forumCategories, auditLogs,
} from "@/db/schema";

/** [question, correct answer, wrong answers, explanation]. Options are shuffled when served. */
type Q = [string, string, string[], string];

const QUIZZES: { category: string; title: string; description: string; questions: Q[] }[] = [
  {
    category: "mathematics", title: "Mathematics Fundamentals", description: "Calculus, algebra, probability and linear algebra essentials.",
    questions: [
      ["What is the derivative of sin(x)?", "cos(x)", ["-cos(x)", "sin(x)", "-sin(x)"], "d/dx sin(x) = cos(x)."],
      ["What is ∫ (1/x) dx?", "ln|x| + C", ["x²/2 + C", "-1/x² + C", "eˣ + C"], "The antiderivative of 1/x is the natural logarithm of |x|."],
      ["What is the determinant of the matrix [[2, 3], [1, 4]]?", "5", ["11", "8", "-5"], "det = (2×4) − (3×1) = 5."],
      ["What is lim(x→0) sin(x)/x?", "1", ["0", "∞", "Undefined"], "This standard limit equals 1."],
      ["The sum of the first n natural numbers is:", "n(n+1)/2", ["n²", "n(n−1)/2", "2n+1"], "Gauss's formula: 1+2+…+n = n(n+1)/2."],
      ["If A is 3×2 and B is 2×4, what is the order of AB?", "3×4", ["2×2", "4×3", "Not defined"], "Inner dimensions match (2), result takes outer dimensions."],
      ["What is the derivative of e^(2x)?", "2e^(2x)", ["e^(2x)", "eˣ", "2x·e^(2x)"], "By the chain rule, d/dx e^(2x) = 2e^(2x)."],
      ["What is log₂(64)?", "6", ["8", "5", "32"], "2⁶ = 64."],
      ["Probability of getting a sum of 7 when rolling two fair dice?", "1/6", ["1/12", "7/36", "1/9"], "6 favourable outcomes out of 36."],
      ["The roots of x² − 5x + 6 = 0 are:", "2 and 3", ["−2 and −3", "1 and 6", "−1 and 6"], "(x−2)(x−3) = 0."],
      ["Which is an eigenvalue of the diagonal matrix [[2, 0], [0, 5]]?", "5", ["0", "7", "10"], "Eigenvalues of a diagonal matrix are its diagonal entries."],
      ["In how many ways can 5 distinct books be arranged on a shelf?", "120", ["25", "60", "24"], "5! = 120."],
      ["What is ∫₀³ 2x dx?", "9", ["6", "3", "18"], "[x²]₀³ = 9."],
      ["What is i² (where i is the imaginary unit)?", "−1", ["1", "i", "0"], "By definition i = √−1, so i² = −1."],
      ["What is the slope of the line through (1, 2) and (3, 8)?", "3", ["2", "6", "1/3"], "(8−2)/(3−1) = 3."],
    ],
  },
  {
    category: "physics", title: "Physics Essentials", description: "Mechanics, electricity, optics and thermodynamics.",
    questions: [
      ["What is the SI unit of force?", "Newton", ["Joule", "Watt", "Pascal"], "1 N = 1 kg·m/s²."],
      ["Approximate acceleration due to gravity near Earth's surface?", "9.8 m/s²", ["8.9 m/s²", "10.8 m/s²", "6.7 m/s²"], "g ≈ 9.8 m/s²."],
      ["Newton's second law is expressed as:", "F = ma", ["F = mv", "F = m/a", "F = ma²"], "Force equals mass times acceleration."],
      ["Speed of light in vacuum is approximately:", "3 × 10⁸ m/s", ["3 × 10⁶ m/s", "3 × 10¹⁰ m/s", "1.5 × 10⁸ m/s"], "c ≈ 299,792,458 m/s."],
      ["The SI unit of electrical resistance is:", "Ohm", ["Ampere", "Volt", "Coulomb"], "Resistance is measured in ohms (Ω)."],
      ["Kinetic energy of a body is given by:", "½mv²", ["mv", "mgh", "m²v"], "KE = ½mv²."],
      ["Which of these is a vector quantity?", "Velocity", ["Speed", "Mass", "Temperature"], "Velocity has magnitude and direction."],
      ["Ohm's law states:", "V = IR", ["V = I/R", "P = IR", "V = I²R"], "Voltage = current × resistance."],
      ["The SI unit of frequency is:", "Hertz", ["Tesla", "Henry", "Weber"], "1 Hz = 1 cycle per second."],
      ["Work done by a force perpendicular to displacement is:", "Zero", ["Maximum", "Negative maximum", "Infinite"], "W = Fd·cos(90°) = 0."],
      ["The photoelectric effect was explained using the photon concept by:", "Albert Einstein", ["Isaac Newton", "Michael Faraday", "James Clerk Maxwell"], "Einstein's 1905 explanation earned the 1921 Nobel Prize."],
      ["The SI unit of momentum is:", "kg·m/s", ["kg·m/s²", "N/m", "J·s"], "p = mv."],
      ["Which lens converges parallel light rays?", "Convex lens", ["Concave lens", "Plane glass sheet", "Diverging lens"], "Convex (converging) lenses focus light to a point."],
      ["The first law of thermodynamics is a statement of:", "Conservation of energy", ["Conservation of momentum", "Increase of entropy", "Unattainability of absolute zero"], "ΔU = Q − W."],
      ["Power is defined as:", "Rate of doing work", ["Force × distance", "Mass × acceleration", "Energy × time"], "P = W/t."],
    ],
  },
  {
    category: "computer-science", title: "Computer Science Core", description: "Algorithms, data structures, OS, networks and databases.",
    questions: [
      ["Time complexity of binary search on a sorted array?", "O(log n)", ["O(n)", "O(n log n)", "O(1)"], "The search space halves each step."],
      ["Which data structure follows LIFO?", "Stack", ["Queue", "Heap", "Graph"], "Last In, First Out."],
      ["Which of these is a relational database?", "PostgreSQL", ["MongoDB", "Redis", "Neo4j"], "PostgreSQL is an SQL relational database."],
      ["The primary purpose of DNS is to:", "Translate domain names into IP addresses", ["Encrypt web traffic", "Assign MAC addresses", "Compress packets"], "DNS resolves names like example.com to IPs."],
      ["Worst-case time complexity of quicksort?", "O(n²)", ["O(n log n)", "O(n)", "O(log n)"], "Occurs with consistently poor pivot choices."],
      ["Which OSI layer is responsible for routing?", "Network layer", ["Transport layer", "Data link layer", "Session layer"], "Layer 3 (IP) handles routing."],
      ["Which is NOT one of the Coffman conditions for deadlock?", "Preemption", ["Mutual exclusion", "Hold and wait", "Circular wait"], "The condition is NO preemption."],
      ["Normalization in DBMS primarily reduces:", "Data redundancy", ["Query syntax", "Number of users", "Network latency"], "Normal forms eliminate redundancy and anomalies."],
      ["Binary representation of decimal 10?", "1010", ["1100", "1001", "1110"], "8 + 2 = 10."],
      ["Which traversal of a BST yields keys in sorted order?", "In-order", ["Pre-order", "Post-order", "Level-order"], "Left, root, right visits keys ascending."],
      ["HTTP status code 404 means:", "Not Found", ["Unauthorized", "Internal Server Error", "Moved Permanently"], "The requested resource does not exist."],
      ["Which of these is non-volatile storage?", "SSD (flash storage)", ["RAM", "CPU cache", "CPU registers"], "SSDs retain data without power."],
      ["Dijkstra's algorithm computes:", "Shortest paths from a source with non-negative edge weights", ["A minimum spanning tree", "A topological ordering", "Maximum flow"], "It greedily finalises the nearest vertex."],
      ["Average-case lookup time in a hash table?", "O(1)", ["O(log n)", "O(n)", "O(n²)"], "With a good hash function and load factor."],
      ["Which CPU scheduling algorithm can cause starvation?", "Shortest Job First", ["Round Robin", "First-Come First-Served", "Fair-share scheduling with aging"], "Long jobs may wait indefinitely."],
    ],
  },
  {
    category: "programming", title: "Programming Practice", description: "Python, JavaScript, Java, C and Git fundamentals.",
    questions: [
      ["In Python, what does print(type([])) output?", "<class 'list'>", ["<class 'tuple'>", "<class 'dict'>", "<class 'array'>"], "[] is an empty list."],
      ["In JavaScript, what is typeof null?", "\"object\"", ["\"null\"", "\"undefined\"", "\"number\""], "A long-standing quirk of JavaScript."],
      ["Which keyword defines a function in Python?", "def", ["function", "func", "fn"], "def name(args):"],
      ["In Java, which is NOT a primitive type?", "String", ["int", "boolean", "char"], "String is a class (reference type)."],
      ["In Python, what is 7 // 2?", "3", ["3.5", "4", "1"], "// is floor division."],
      ["In JavaScript, which declares a block-scoped binding that cannot be reassigned?", "const", ["var", "let", "static"], "const bindings cannot be reassigned."],
      ["In C, which operator returns the address of a variable?", "&", ["*", "->", "#"], "&x yields a pointer to x."],
      ["What does [x*x for x in range(3)] produce in Python?", "[0, 1, 4]", ["[1, 4, 9]", "[0, 1, 2]", "[1, 2, 3]"], "range(3) = 0, 1, 2."],
      ["Every correct recursive function must have:", "A base case", ["A loop", "A global variable", "A class"], "The base case stops recursion."],
      ["Which Git command creates a new branch and switches to it?", "git checkout -b <name>", ["git branch -d <name>", "git merge <name>", "git push -b <name>"], "Also: git switch -c <name>."],
      ["Bundling data with the methods that operate on it is called:", "Encapsulation", ["Polymorphism", "Inheritance", "Recursion"], "A core OOP principle."],
      ["What does [1, 2, 3].map(x => x * 2) return in JavaScript?", "[2, 4, 6]", ["[1, 2, 3, 2]", "12", "[2, 4, 6, 8]"], "map transforms each element."],
      ["In C, which standard function allocates memory on the heap?", "malloc()", ["alloc()", "new()", "heap()"], "Declared in <stdlib.h>."],
      ["Which Python type is immutable?", "tuple", ["list", "dict", "set"], "Tuples cannot be modified after creation."],
      ["Which SQL clause removes duplicate rows from a result?", "SELECT DISTINCT", ["UNIQUE SELECT", "SELECT ONLY", "GROUP UNIQUE"], "DISTINCT filters duplicates."],
    ],
  },
  {
    category: "electronics", title: "Electronics Basics", description: "Semiconductors, digital logic and circuit theory.",
    questions: [
      ["A diode allows current to flow primarily in:", "One direction", ["Both directions equally", "Neither direction", "Only with AC"], "Forward-biased conduction."],
      ["Which gate outputs 1 only when all inputs are 1?", "AND", ["OR", "XOR", "NOR"], "AND is true only if all inputs are true."],
      ["Which is a universal logic gate?", "NAND", ["AND", "OR", "XOR"], "Any logic function can be built from NAND alone."],
      ["The SI unit of capacitance is:", "Farad", ["Henry", "Ohm", "Tesla"], "C = Q/V, measured in farads."],
      ["How many terminals does a BJT have?", "3", ["2", "4", "5"], "Emitter, base and collector."],
      ["Silicon doped with phosphorus becomes:", "n-type", ["p-type", "Intrinsic", "An insulator"], "Phosphorus donates extra electrons."],
      ["The input impedance of an ideal op-amp is:", "Infinite", ["Zero", "50 Ω", "1 kΩ"], "An ideal op-amp draws no input current."],
      ["What is 1 XOR 1?", "0", ["1", "2", "Undefined"], "XOR is 1 only when inputs differ."],
      ["Total resistance of resistors in series equals:", "The sum of the resistances", ["The reciprocal of the sum of reciprocals", "The product of the resistances", "The average resistance"], "R = R₁ + R₂ + …"],
      ["Binary 1111 in hexadecimal is:", "F", ["E", "A", "FF"], "1111₂ = 15₁₀ = F₁₆."],
      ["Mains AC frequency in India and Europe is:", "50 Hz", ["60 Hz", "100 Hz", "220 Hz"], "North America uses 60 Hz."],
      ["A single flip-flop stores:", "1 bit", ["1 byte", "2 bits", "4 bits"], "Flip-flops are 1-bit memory elements."],
      ["A rectifier converts:", "AC to DC", ["DC to AC", "Low voltage to high voltage", "Analog to digital"], "Diodes block reverse half-cycles."],
      ["A Zener diode is commonly used for:", "Voltage regulation", ["Amplification", "Light emission", "Frequency mixing"], "It holds a stable reverse breakdown voltage."],
      ["As frequency increases, capacitive reactance:", "Decreases", ["Increases", "Stays constant", "Becomes infinite"], "Xc = 1/(2πfC)."],
    ],
  },
  {
    category: "general-aptitude", title: "General Aptitude", description: "Quantitative aptitude and logical reasoning for placement tests.",
    questions: [
      ["What is 20% of 150?", "30", ["25", "35", "20"], "0.2 × 150 = 30."],
      ["A train at 60 km/h travels how far in 2.5 hours?", "150 km", ["120 km", "140 km", "160 km"], "Distance = speed × time."],
      ["Next number: 2, 6, 12, 20, 30, ?", "42", ["40", "36", "44"], "Differences are 4, 6, 8, 10, 12."],
      ["5 workers finish a job in 12 days. How long for 10 workers?", "6 days", ["24 days", "10 days", "8 days"], "Work is inversely proportional to workers."],
      ["Simple interest on ₹1000 at 5% per annum for 2 years?", "₹100", ["₹50", "₹110", "₹105"], "SI = PRT/100."],
      ["Average of 10, 20, 30 and 40?", "25", ["20", "30", "100"], "100 / 4 = 25."],
      ["64 is divided in the ratio 3:5. The larger part is:", "40", ["24", "38", "32"], "64 × 5/8 = 40."],
      ["Angle between clock hands at 3:00?", "90°", ["45°", "180°", "60°"], "Each hour mark is 30°."],
      ["Odd one out: 2, 3, 5, 9, 11", "9", ["2", "3", "11"], "9 is the only non-prime."],
      ["A price rises 10% and then falls 10%. Net change?", "1% decrease", ["No change", "1% increase", "2% decrease"], "1.1 × 0.9 = 0.99."],
      ["If CAT = 24 (C=3, A=1, T=20), then DOG = ?", "26", ["24", "25", "27"], "4 + 15 + 7 = 26."],
      ["Probability of heads when tossing a fair coin?", "1/2", ["1/4", "1", "1/3"], "Two equally likely outcomes."],
      ["Pipe A fills a tank in 4 h, pipe B in 6 h. Together?", "2.4 hours", ["5 hours", "2 hours", "3 hours"], "1/4 + 1/6 = 5/12 → 12/5 h."],
      ["LCM of 12 and 18?", "36", ["6", "72", "24"], "Smallest common multiple."],
      ["Convert 5 m/s to km/h.", "18 km/h", ["15 km/h", "20 km/h", "25 km/h"], "Multiply by 18/5."],
    ],
  },
  {
    category: "english", title: "English & Communication", description: "Vocabulary, grammar and usage.",
    questions: [
      ["Synonym of 'Abundant':", "Plentiful", ["Scarce", "Rare", "Tiny"], "Abundant means existing in large quantities."],
      ["Antonym of 'Transparent':", "Opaque", ["Clear", "Lucid", "Obvious"], "Opaque does not let light through."],
      ["Choose the correct spelling:", "Accommodate", ["Acommodate", "Accomodate", "Acomodate"], "Double 'c' and double 'm'."],
      ["She ___ to college every day.", "goes", ["go", "going", "gone"], "Third-person singular simple present."],
      ["Plural of 'criterion':", "criteria", ["criterions", "criterias", "criterium"], "Greek-origin plural."],
      ["'Break the ice' means:", "To start a conversation in a social setting", ["To damage something fragile", "To feel cold", "To end a friendship"], "An idiom about easing tension."],
      ["Passive voice of 'They built the bridge':", "The bridge was built by them.", ["The bridge is built by them.", "The bridge built by them.", "They were built by the bridge."], "Past simple passive: was + past participle."],
      ["Which word is a conjunction?", "although", ["quickly", "beautiful", "under"], "It joins clauses."],
      ["___ hour ago, I called her.", "An", ["A", "The", "No article"], "'Hour' begins with a vowel sound."],
      ["Synonym of 'Diligent':", "Hardworking", ["Lazy", "Careless", "Reluctant"], "Diligent means showing care and effort."],
      ["Identify the adverb: 'She sang beautifully.'", "beautifully", ["She", "sang", "None of these"], "It modifies the verb 'sang'."],
      ["Meaning of 'ubiquitous':", "Present everywhere", ["Extremely rare", "Very ancient", "Invisible"], "Found everywhere."],
      ["Choose the grammatically correct sentence:", "Each of the students has submitted the assignment.", ["Each of the students have submitted the assignment.", "Each of the student have submitted the assignment.", "Each of the students having submitted the assignment."], "'Each' takes a singular verb."],
      ["One word for 'a person who speaks many languages':", "Polyglot", ["Bibliophile", "Philanthropist", "Monologist"], "Poly (many) + glot (tongue)."],
      ["Antonym of 'Expand':", "Contract", ["Enlarge", "Extend", "Grow"], "Contract means to become smaller."],
    ],
  },
  {
    category: "career-preparation", title: "Career Preparation", description: "Resumes, interviews, workplace skills and job search.",
    questions: [
      ["The STAR interview method stands for:", "Situation, Task, Action, Result", ["Skill, Talent, Ability, Result", "Strategy, Task, Aim, Review", "Situation, Target, Approach, Reflection"], "A structure for behavioural answers."],
      ["Recommended resume length for most freshers?", "One page", ["Three to four pages", "Five pages", "As long as possible"], "Recruiters skim quickly."],
      ["In hiring, ATS stands for:", "Applicant Tracking System", ["Automated Testing Suite", "Advanced Talent Search", "Application Transfer Service"], "Software that parses and filters resumes."],
      ["Best response when you don't know an interview answer?", "Acknowledge it honestly and explain how you would find out", ["Bluff confidently", "Stay silent", "Change the topic"], "Honesty and problem-solving approach matter."],
      ["A strong LinkedIn headline should contain:", "A concise summary of your role, skills and goals", ["Your home address", "Your salary expectation", "Your favourite movies"], "It's your professional tagline."],
      ["In job offers, CTC stands for:", "Cost to Company", ["Current Take-home Cash", "Company Training Cost", "Contract Term Conditions"], "Total annual cost incl. benefits."],
      ["Which of these is a soft skill?", "Communication", ["Python", "SQL", "CAD modelling"], "Soft skills are interpersonal."],
      ["A good question to ask at the end of an interview:", "What does success look like in this role in the first six months?", ["What does your company do?", "How soon can I get promoted?", "I don't have any questions."], "Shows genuine interest and preparation."],
      ["The main purpose of a cover letter is to:", "Explain your fit and motivation for a specific role", ["List all your grades", "Replace your resume", "Negotiate salary"], "It complements the resume."],
      ["In a career context, networking means:", "Building professional relationships", ["Configuring routers", "Applying to jobs randomly", "Playing online games"], "Many roles are filled through referrals."],
      ["A portfolio is most useful for:", "Showcasing real work and projects", ["Listing hobbies", "Storing certificates only", "Showing salary history"], "Evidence beats claims."],
      ["Best practice in a group discussion:", "Listen actively and build on others' points", ["Dominate the conversation", "Never speak", "Interrupt frequently"], "Collaboration is evaluated."],
      ["An internship primarily offers:", "Practical industry experience", ["A guaranteed job", "Only academic credits", "A paid vacation"], "Real-world exposure and skills."],
      ["Which is an attribute of a SMART goal?", "Measurable", ["Massive", "Mandatory", "Mysterious"], "Specific, Measurable, Achievable, Relevant, Time-bound."],
      ["The best approach to salary negotiation is to:", "Research market rates and justify with your skills", ["Always accept the first offer", "Demand double", "Invent competing offers"], "Data-backed, honest negotiation works best."],
    ],
  },
];

const INTERVIEWS: { slug: string; name: string; description: string; questions: [string, string][] }[] = [
  { slug: "technical", name: "Technical", description: "General engineering and problem-solving questions.", questions: [
    ["Explain the difference between a process and a thread.", "Memory isolation, resource sharing, context-switch cost, use cases."],
    ["How would you design a URL shortener?", "Hashing/ID generation, database schema, redirects, caching, scaling, collisions."],
    ["What happens when you type a URL into a browser and press Enter?", "DNS lookup, TCP/TLS handshake, HTTP request, server response, rendering."],
    ["Explain REST and what makes an API RESTful.", "Resources, HTTP verbs, statelessness, status codes, representations."],
    ["How do you debug a production issue you cannot reproduce locally?", "Logs, metrics, tracing, hypotheses, feature flags, safe rollback."],
  ] },
  { slug: "hr", name: "HR", description: "Motivation, fit and career goals.", questions: [
    ["Tell me about yourself.", "Concise present-past-future structure; relevant education, projects and goals."],
    ["Why do you want to join our company?", "Research on company, alignment with values/products, how you add value."],
    ["Where do you see yourself in five years?", "Realistic growth, learning goals, alignment with the role."],
    ["What are your strengths and weaknesses?", "Evidence-backed strengths; genuine weakness with improvement steps."],
  ] },
  { slug: "behavioral", name: "Behavioral", description: "STAR-method situational questions.", questions: [
    ["Describe a time you worked in a team with a conflict. How did you resolve it?", "STAR: situation, your actions, communication, outcome, learning."],
    ["Tell me about a time you failed and what you learned.", "Ownership, reflection, concrete changes afterwards."],
    ["Describe a situation where you had to meet a tight deadline.", "Prioritisation, planning, communication, result."],
    ["Give an example of when you showed leadership.", "Initiative, influencing others, measurable outcome."],
  ] },
  { slug: "aptitude", name: "Aptitude", description: "Reasoning and estimation problems explained aloud.", questions: [
    ["Estimate how many smartphones are sold in your country each year. Walk through your reasoning.", "Population, adoption rate, replacement cycle, assumptions stated clearly."],
    ["You have 8 identical-looking balls, one heavier. Find it with a balance in two weighings.", "Split 3-3-2, compare, then narrow down."],
    ["If a clock shows 3:15, what is the angle between the hands? Explain.", "Minute hand at 90°, hour hand at 97.5°, difference 7.5°."],
  ] },
  { slug: "computer-science", name: "Computer Science", description: "Core CS theory: OS, DBMS, networks, DSA.", questions: [
    ["Explain ACID properties in databases.", "Atomicity, Consistency, Isolation, Durability with examples."],
    ["What is virtual memory and why is it used?", "Paging, address translation, isolation, larger address space, page faults."],
    ["Compare TCP and UDP.", "Reliability, ordering, connection setup, overhead, use cases."],
    ["What is the difference between an array and a linked list?", "Memory layout, access time, insertion/deletion cost, cache locality."],
    ["Explain database indexing and its trade-offs.", "B-trees, faster reads, slower writes, storage cost, selectivity."],
  ] },
  { slug: "programming", name: "Programming", description: "Coding concepts and language knowledge.", questions: [
    ["How would you reverse a linked list? Explain the time and space complexity.", "Iterative pointer reversal, O(n) time, O(1) space; recursive alternative."],
    ["Explain closures in JavaScript with an example.", "Function retaining access to its lexical scope; counters, data privacy."],
    ["What is the difference between == and === in JavaScript?", "Type coercion vs strict equality; examples."],
    ["How do you find duplicates in an array efficiently?", "Hash set O(n) time/O(n) space; sorting O(n log n)."],
    ["Explain object-oriented principles with a real example.", "Encapsulation, inheritance, polymorphism, abstraction with code example."],
  ] },
];

const PLACEMENTS: [string, number, number, number, number, number, string[]][] = [
  ["Computer Science", 2022, 88, 7.2, 32, 142, ["Demo Tech Corp", "Sample Systems", "Example Cloud"]],
  ["Computer Science", 2023, 91, 7.9, 38, 156, ["Demo Tech Corp", "Placeholder AI", "Example Cloud"]],
  ["Computer Science", 2024, 93, 8.4, 41, 168, ["Placeholder AI", "Sample Systems", "Mock Analytics"]],
  ["Electronics", 2022, 76, 5.6, 18, 84, ["Sample Semiconductors", "Demo Devices"]],
  ["Electronics", 2023, 79, 6.1, 22, 92, ["Sample Semiconductors", "Mock Embedded"]],
  ["Electronics", 2024, 82, 6.5, 24, 97, ["Demo Devices", "Mock Embedded", "Placeholder AI"]],
  ["Mechanical", 2022, 68, 4.8, 14, 71, ["Example Motors", "Demo Manufacturing"]],
  ["Mechanical", 2023, 71, 5.1, 16, 76, ["Example Motors", "Sample Aero"]],
  ["Mechanical", 2024, 74, 5.4, 18, 80, ["Sample Aero", "Demo Manufacturing"]],
  ["Information Technology", 2022, 85, 6.8, 28, 118, ["Demo Tech Corp", "Mock Analytics"]],
  ["Information Technology", 2023, 87, 7.3, 30, 124, ["Example Cloud", "Mock Analytics"]],
  ["Information Technology", 2024, 90, 7.8, 35, 131, ["Example Cloud", "Placeholder AI"]],
];

const NEWS: [string, string, string][] = [
  ["ai", "Small language models are becoming practical for on-device study tools", "Editorial explainer: why compact AI models matter for students with limited connectivity, and the trade-offs in accuracy."],
  ["programming", "TypeScript adoption keeps rising in student projects", "Editorial explainer on why static typing helps teams catch bugs earlier in hackathons and capstone projects."],
  ["cybersecurity", "Why passkeys are replacing passwords", "Editorial explainer: how passkeys use public-key cryptography to resist phishing, and how to enable them on your accounts."],
  ["web-development", "Server components and the return of server-rendered apps", "Editorial explainer on how modern frameworks split rendering between server and client for performance."],
  ["college-technology", "Digital note-taking: tips for organising a semester of notes", "Editorial guide on tagging, pinning and revising notes effectively — try it in COLLEGE GEAR Notes."],
  ["career", "Building a project portfolio recruiters actually read", "Editorial guide: focus on 2–3 deep projects with clear problem statements, results and code quality."],
  ["ai", "Using AI assistants responsibly for coursework", "Editorial explainer on academic integrity, verifying AI output, and using AI to learn rather than to outsource."],
  ["cybersecurity", "A student's checklist for securing personal devices", "Editorial checklist: updates, disk encryption, password managers, MFA and backups."],
];

const ANNOUNCEMENTS: [string, string, string, "low" | "normal" | "high" | "urgent"][] = [
  ["Welcome to COLLEGE GEAR (demo announcement)", "This is a sample announcement created by the COLLEGE GEAR demo seed. Administrators can create, edit and delete announcements from the Admin panel.", "general", "normal"],
  ["Mid-semester study planning (sample)", "Sample notice: use the Schedule module to block study sessions ahead of mid-semester assessments.", "academic", "high"],
  ["Coding lab practice hours (sample)", "Sample notice: the online Coding Lab is available 24/7. Save your sessions to continue later.", "events", "normal"],
  ["Mock interview week (sample)", "Sample notice: practice Technical, HR and Behavioral interviews with AI coaching feedback.", "placements", "high"],
  ["Platform maintenance window (sample)", "Sample notice: demonstration of an urgent-priority announcement. No real maintenance is scheduled.", "system", "urgent"],
  ["Community guidelines (sample)", "Be respectful, avoid sharing personal data, and report inappropriate posts. Moderators review reports.", "community", "low"],
];

const RESOURCES: [string, string, string, string][] = [
  ["MDN Web Docs", "Authoritative documentation for HTML, CSS and JavaScript.", "https://developer.mozilla.org", "documentation"],
  ["Python Documentation", "Official Python language and standard library docs.", "https://docs.python.org/3/", "documentation"],
  ["Harvard CS50", "Free introduction to computer science.", "https://cs50.harvard.edu/x/", "videos"],
  ["freeCodeCamp", "Free interactive coding curriculum and certifications.", "https://www.freecodecamp.org", "programming"],
  ["Khan Academy", "Free lessons in mathematics, physics and more.", "https://www.khanacademy.org", "study-material"],
  ["NPTEL", "Online engineering and science courses from IITs and IISc.", "https://nptel.ac.in", "study-material"],
  ["LeetCode", "Coding interview practice problems.", "https://leetcode.com", "interview"],
  ["Tech Interview Handbook", "Free curated interview preparation guide.", "https://www.techinterviewhandbook.org", "interview"],
  ["roadmap.sh", "Community-driven career roadmaps for developers.", "https://roadmap.sh", "career"],
  ["Pro Git Book", "The complete Git book, free online.", "https://git-scm.com/book/en/v2", "documentation"],
  ["Overleaf", "Collaborative LaTeX editor for reports and resumes.", "https://www.overleaf.com", "tools"],
  ["Excalidraw", "Virtual whiteboard for diagrams and system design.", "https://excalidraw.com", "tools"],
  ["MIT OpenCourseWare", "Free MIT course materials.", "https://ocw.mit.edu", "college-resources"],
];

const FORUM: [string, string, string][] = [
  ["general", "General", "Anything student life related."],
  ["academics", "Academics", "Course doubts, study tips and exam prep."],
  ["programming", "Programming", "Code help, projects and tools."],
  ["placements", "Placements & Careers", "Interviews, internships and job search."],
  ["projects", "Projects & Hackathons", "Find teammates and share what you build."],
  ["announcements-discussion", "Campus Discussion", "Discuss events and announcements."],
];

let seedPromise: Promise<void> | null = null;

/** Idempotent demo seed — runs once per database (guarded by an advisory lock + marker row). */
export function ensureSeeded() {
  if (!seedPromise) seedPromise = runSeed().catch((e) => {
    seedPromise = null;
    console.error("[seed] failed", e);
  });
  return seedPromise;
}

async function runSeed() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(727274)`);
    const [marker] = await tx.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.action, "system.seed")).limit(1);
    if (marker) return;

    for (const qz of QUIZZES) {
      const [quiz] = await tx.insert(quizzes).values({ title: qz.title, category: qz.category, description: qz.description, timeLimitSeconds: 900, questionCount: 15 }).returning();
      for (const [question, correct, wrong, explanation] of qz.questions) {
        const [q] = await tx.insert(quizQuestions).values({ quizId: quiz.id, question, explanation }).returning();
        await tx.insert(quizOptions).values([correct, ...wrong].map((text, i) => ({ questionId: q.id, text, isCorrect: i === 0, position: i })));
      }
    }
    for (const c of INTERVIEWS) {
      const [cat] = await tx.insert(interviewCategories).values({ slug: c.slug, name: c.name, description: c.description }).onConflictDoNothing().returning();
      if (cat) await tx.insert(interviewQuestions).values(c.questions.map(([question, guidance]) => ({ categoryId: cat.id, question, guidance })));
    }
    await tx.insert(placementStats).values(PLACEMENTS.map(([department, graduationYear, placementRate, averagePackage, highestPackage, offers, recruiters]) => ({ department, graduationYear, placementRate, averagePackage, highestPackage, offers, recruiters, isDemo: true }))).onConflictDoNothing();
    await tx.insert(news).values(NEWS.map(([category, title, summary], i) => ({ category, title, summary, content: summary, isDemo: true, publishedAt: new Date(Date.now() - i * 86400_000) })));
    await tx.insert(announcements).values(ANNOUNCEMENTS.map(([title, content, category, priority], i) => ({ title, content, category, priority, authorName: "COLLEGE GEAR Demo", publishedAt: new Date(Date.now() - i * 3600_000 * 20) })));
    await tx.insert(resources).values(RESOURCES.map(([title, description, url, category]) => ({ title, description, url, category })));
    await tx.insert(forumCategories).values(FORUM.map(([slug, name, description]) => ({ slug, name, description }))).onConflictDoNothing();

    await tx.insert(auditLogs).values({ action: "system.seed", metadata: { version: 1 } });
    console.info("[seed] demo data seeded");
  });
}

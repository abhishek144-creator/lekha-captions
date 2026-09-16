from __future__ import annotations

from pathlib import Path
from datetime import date
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "output" / "pdf" / "Lekha_Captions_MUDRA_Kishore_Project_Cost_Estimate.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

BLUE = HexColor("#123A63")
NAVY = HexColor("#0A2642")
GOLD = HexColor("#D8A928")
PALE_BLUE = HexColor("#EAF2F8")
PALE_GOLD = HexColor("#FFF7DE")
PALE_GREEN = HexColor("#EAF6EF")
PALE_RED = HexColor("#FDEEEE")
MID_GREY = HexColor("#667085")
LIGHT_GREY = HexColor("#F4F6F8")
DARK = HexColor("#182230")

FONT_REG = "ArialLC"
FONT_BOLD = "ArialLC-Bold"
pdfmetrics.registerFont(TTFont(FONT_REG, r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont(FONT_BOLD, r"C:\Windows\Fonts\arialbd.ttf"))


def money(value: int | float) -> str:
    return "₹{:,.0f}".format(value)


def esc(value: object) -> str:
    return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="LCBody", parent=styles["BodyText"], fontName=FONT_REG,
    fontSize=9.2, leading=13.2, textColor=DARK, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="LCBodySmall", parent=styles["BodyText"], fontName=FONT_REG,
    fontSize=7.7, leading=10.3, textColor=DARK, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="LCBodyMuted", parent=styles["BodyText"], fontName=FONT_REG,
    fontSize=8, leading=11, textColor=MID_GREY, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="LCSection", parent=styles["Heading1"], fontName=FONT_BOLD,
    fontSize=15.5, leading=19, textColor=NAVY, spaceBefore=8, spaceAfter=8,
    keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="LCSub", parent=styles["Heading2"], fontName=FONT_BOLD,
    fontSize=10.8, leading=14, textColor=BLUE, spaceBefore=7, spaceAfter=5,
    keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="LCMini", parent=styles["Heading3"], fontName=FONT_BOLD,
    fontSize=9, leading=12, textColor=DARK, spaceBefore=4, spaceAfter=3,
    keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="LCTable", parent=styles["BodyText"], fontName=FONT_REG,
    fontSize=7.5, leading=9.5, textColor=DARK,
))
styles.add(ParagraphStyle(
    name="LCTableBold", parent=styles["BodyText"], fontName=FONT_BOLD,
    fontSize=7.5, leading=9.5, textColor=DARK,
))
styles.add(ParagraphStyle(
    name="LCNote", parent=styles["BodyText"], fontName=FONT_REG,
    fontSize=7.5, leading=10, textColor=MID_GREY, leftIndent=7, rightIndent=7,
))
styles.add(ParagraphStyle(
    name="LCCoverTitle", parent=styles["Title"], fontName=FONT_BOLD,
    fontSize=26, leading=31, alignment=TA_CENTER, textColor=colors.white,
))
styles.add(ParagraphStyle(
    name="LCCoverSub", parent=styles["BodyText"], fontName=FONT_REG,
    fontSize=12, leading=17, alignment=TA_CENTER, textColor=colors.white,
))
styles.add(ParagraphStyle(
    name="LCMetric", parent=styles["BodyText"], fontName=FONT_BOLD,
    fontSize=15, leading=18, alignment=TA_CENTER, textColor=NAVY,
))
styles.add(ParagraphStyle(
    name="LCMetricLabel", parent=styles["BodyText"], fontName=FONT_REG,
    fontSize=7.5, leading=9.5, alignment=TA_CENTER, textColor=MID_GREY,
))


def P(text: object, style: str = "LCBody") -> Paragraph:
    return Paragraph(str(text), styles[style])


def table(data, widths, *, header=True, aligns=None, font_size=7.5, row_bgs=None):
    rows = []
    for r, row in enumerate(data):
        converted = []
        for cell in row:
            if isinstance(cell, Paragraph):
                converted.append(cell)
            else:
                converted.append(P(esc(cell), "LCTableBold" if header and r == 0 else "LCTable"))
        rows.append(converted)
    t = Table(rows, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, HexColor("#CBD5E1")),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    if header:
        commands.extend([
            ("BACKGROUND", (0, 0), (-1, 0), BLUE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ])
        for cell in rows[0]:
            if isinstance(cell, Paragraph):
                cell.style.textColor = colors.white
    for r in range(1 if header else 0, len(rows)):
        if r % 2 == (0 if header else 1):
            commands.append(("BACKGROUND", (0, r), (-1, r), LIGHT_GREY))
    if aligns:
        for col, align in enumerate(aligns):
            commands.append(("ALIGN", (col, 0), (col, -1), align))
    if row_bgs:
        for row_idx, bg in row_bgs.items():
            commands.append(("BACKGROUND", (0, row_idx), (-1, row_idx), bg))
    t.setStyle(TableStyle(commands))
    return t


def bullet(text: str, level: int = 0) -> Paragraph:
    return Paragraph(
        f"• {text}",
        ParagraphStyle(
            f"bullet-{level}", parent=styles["LCBody"],
            leftIndent=12 + level * 8, firstLineIndent=-7, spaceAfter=3,
        ),
    )


class ReportDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(
            filename, pagesize=A4,
            leftMargin=17 * mm, rightMargin=17 * mm,
            topMargin=20 * mm, bottomMargin=18 * mm,
            title="Lekha Captions - PMMY MUDRA Kishore Project Cost Estimate",
            author="Shiv Shakti Enterprises",
            subject="Project cost estimate and first-year infrastructure requirement",
        )
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="main")
        self.addPageTemplates(PageTemplate(id="normal", frames=frame, onPage=self._header_footer))

    def _header_footer(self, canvas, doc):
        if doc.page == 1:
            return
        canvas.saveState()
        canvas.setStrokeColor(HexColor("#D7DEE6"))
        canvas.setLineWidth(0.5)
        canvas.line(17 * mm, A4[1] - 13 * mm, A4[0] - 17 * mm, A4[1] - 13 * mm)
        canvas.setFont(FONT_BOLD, 7.5)
        canvas.setFillColor(NAVY)
        canvas.drawString(17 * mm, A4[1] - 10 * mm, "SHIV SHAKTI ENTERPRISES | LEKHA CAPTIONS")
        canvas.setFont(FONT_REG, 7)
        canvas.setFillColor(MID_GREY)
        canvas.drawRightString(A4[0] - 17 * mm, A4[1] - 10 * mm, "PMMY - MUDRA KISHORE | PROJECT ESTIMATE")
        canvas.line(17 * mm, 13 * mm, A4[0] - 17 * mm, 13 * mm)
        canvas.drawString(17 * mm, 9 * mm, "Prepared 12 September 2026 | Estimates subject to supporting quotations")
        canvas.drawRightString(A4[0] - 17 * mm, 9 * mm, f"Page {doc.page}")
        canvas.restoreState()


story = []


def section(number: str, title: str):
    story.append(P(f"{number}. {title}", "LCSection"))
    story.append(HRFlowable(width="100%", thickness=1.1, color=GOLD, spaceAfter=7))


def note(text: str, bg=PALE_GOLD):
    box = Table([[P(text, "LCNote")]], colWidths=[176 * mm])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg),
        ("BOX", (0, 0), (-1, -1), 0.6, GOLD if bg == PALE_GOLD else BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([box, Spacer(1, 5)])


# Cover page
cover = Table([
    [Spacer(1, 28 * mm)],
    [P("DETAILED PROJECT COST ESTIMATE<br/>&amp;<br/>FIRST-YEAR INFRASTRUCTURE REQUIREMENT", "LCCoverTitle")],
    [Spacer(1, 7 * mm)],
    [P("SHIV SHAKTI ENTERPRISES", "LCCoverSub")],
    [P("Product: <b>LEKHA CAPTIONS</b>", "LCCoverSub")],
    [P("AI-Powered Multilingual Video Captioning SaaS", "LCCoverSub")],
    [Spacer(1, 13 * mm)],
    [Table([
        [P("Proposed Scheme", "LCMetricLabel"), P("Proposed Bank Finance", "LCMetricLabel"), P("Bank", "LCMetricLabel")],
        [P("PMMY - MUDRA KISHORE", "LCMetric"), P("Up to ₹5,00,000", "LCMetric"), P("Indian Bank", "LCMetric")],
    ], colWidths=[55 * mm, 60 * mm, 50 * mm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.8, GOLD),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, HexColor("#D6B95E")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))],
    [Spacer(1, 16 * mm)],
    [P("Prepared for credit appraisal and supporting-document submission", "LCCoverSub")],
    [P("Promoter: Abhishek Naidu | Sole Proprietorship | Udyam and GST Registered", "LCCoverSub")],
    [Spacer(1, 10 * mm)],
    [P("Document status: Project estimate - not a vendor invoice or sanction letter", "LCCoverSub")],
    [P("Date: 12 September 2026", "LCCoverSub")],
], colWidths=[176 * mm], rowHeights=None)
cover.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), NAVY),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
story.extend([cover, PageBreak()])


section("1", "Executive Summary")
story.append(P(
    "Shiv Shakti Enterprises proposes to commercialise Lekha Captions, a founder-developed software-as-a-service application for multilingual video transcription, caption editing and caption-burned video exports. The request is structured as a composite PMMY - MUDRA Kishore facility of up to ₹5,00,000 for a lean first-year launch phase. The project is founder-operated and does not assume a large employee payroll in Year 1."
))
story.append(P(
    "The repository review confirms that the business requires more than a website: it uses a React/Vite editor, a FastAPI media API, durable Redis/RQ queues, separate export and transcription consumers, FFmpeg and Chromium rendering, Firebase Authentication/Firestore/Storage, Google Cloud compute and operational monitoring. The equipment requirement is therefore limited to one business laptop and one desktop workstation; production rendering remains server-side, so no premium gaming GPU is proposed."
))

summary_metrics = Table([
    [P(money(500000), "LCMetric"), P(money(839000), "LCMetric"), P(money(50000), "LCMetric"), P(money(1060500), "LCMetric")],
    [P("Recommended MUDRA phase", "LCMetricLabel"), P("Forward Year-1 requirement", "LCMetricLabel"), P("Prior promoter investment", "LCMetricLabel"), P("Conservative Year-1 revenue", "LCMetricLabel")],
], colWidths=[44 * mm] * 4)
summary_metrics.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE),
    ("BOX", (0, 0), (-1, -1), 0.5, BLUE),
    ("INNERGRID", (0, 0), (-1, -1), 0.3, HexColor("#B8C7D6")),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
story.extend([summary_metrics, Spacer(1, 6)])
note(
    "Recommendation: adopt Option B. Financing all 12 months of rent, electricity and the full deposit would consume ₹2,90,000 before technology, leaving inadequate capacity for the infrastructure that produces revenue. Option B funds six months of rent and power, the full deposit, both computers, and a meaningful cloud/API launch reserve. The remaining Year-1 costs are funded progressively from revenue and promoter resources.",
    PALE_GREEN,
)

story.append(P("Scheme fit", "LCSub"))
story.append(P(
    "The Department of Financial Services defines Kishore as above ₹50,000 and up to ₹5 lakh. PMMY may meet both term-loan and working-capital requirements for eligible non-farm micro enterprises. Final eligibility, margin, disbursement and documentation remain subject to Indian Bank appraisal and sanction."
))


section("2", "Promoter Profile")
promoter_rows = [
    ["Particular", "Details"],
    ["Promoter", "Abhishek Naidu"],
    ["Qualification", "B.E. Mechanical - Mumbai University"],
    ["Relevant experience", "Video editing; content creation; digital marketing; social media management; AI tools; creator and manager of Lekha Captions"],
    ["Business constitution", "Shiv Shakti Enterprises - Sole Proprietorship"],
    ["Registrations", "Udyam Registration: Yes | GST Registration: Yes"],
    ["Prior investment", "Approximately ₹50,000 already invested in product development and pre-launch work; separately disclosed and not included in the ₹5,00,000 bank-finance utilisation."],
]
story.append(table(promoter_rows, [44 * mm, 132 * mm]))
story.append(Spacer(1, 5))
note("The promoter's father is a Government employee working as JWM - Maintenance. He is not represented in this report as guarantor, co-borrower or security provider.")


section("3", "Business Model")
for item in [
    "Target customers: creators, agencies, educators, small brands and businesses producing short-form or multilingual video content.",
    "Value proposition: upload video, generate word-timed captions, edit style and timing, apply templates, and export captioned video from one workflow.",
    "Revenue model: paid subscription/package tiers proposed at ₹2,500, ₹4,500 and ₹6,500. The financial projection assumes a weighted average realisation of ₹3,500 per paying customer per month and does not assume 1,000 paying customers.",
    "Operating model: founder-led sales, product management and support during Year 1; usage-dependent cloud and AI costs grow only with customer activity.",
    "Payment and account controls: the repository includes Razorpay payment handling, Firebase account records, credits, usage limits and signed export delivery.",
]:
    story.append(bullet(item))


section("4", "Product Description")
story.append(P(
    "Lekha Captions is an AI-powered multilingual video captioning, transcription and editing application. It supports Indian-language speech through Sarvam AI where configured, wider multilingual transcription through OpenAI Whisper, word-level timing, caption templates, manual text and style adjustment, and downloadable captioned video exports. Source videos and completed exports are treated as short-retention media rather than permanent local files."
))
story.append(P("Primary user workflow", "LCSub"))
workflow = [
    ["Stage", "Repository-derived operation", "Commercial relevance"],
    ["1. Account", "Firebase Authentication, App Check and Firestore user/account data", "Controlled access and usage entitlement"],
    ["2. Upload", "FastAPI streaming upload, file validation and malware scanning", "Accepts customer media safely"],
    ["3. Transcription", "Audio extraction with FFmpeg; Sarvam for configured Indian languages and Whisper for other supported languages", "Core paid AI function"],
    ["4. Edit", "React/Vite caption editor, templates, word styling and timing controls", "Differentiated creator experience"],
    ["5. Export", "RQ job queue; Chromium/CSS or ASS generation; FFmpeg rendering", "Produces the billable output"],
    ["6. Delivery", "Firebase Storage, signed URLs, expiry records and download", "Secure, time-limited customer delivery"],
]
story.append(table(workflow, [28 * mm, 91 * mm, 57 * mm]))


section("5", "Actual Technical Architecture - Repository Derived")
architecture = [
    ["Layer", "Required component", "Evidence and purpose"],
    ["Frontend", "React 18 / Vite editor; separate Next.js marketing site; Cloud Run frontend staging", "Browser editor, account UI, public marketing and legal pages"],
    ["API", "FastAPI / Uvicorn container on Google Compute Engine", "Authenticated upload, processing, accounts, payments, export orchestration and readiness"],
    ["Workers", "RQ export worker plus separate transcription queue consumer", "Prevents FFmpeg/Chromium exports from blocking transcription and API requests"],
    ["Media", "FFmpeg/FFprobe, Chromium/Puppeteer, fonts and scratch disk", "Audio extraction, subtitle generation, template rendering and MP4 output"],
    ["Queue/state", "Redis / Memorystore with RQ", "Durable queue admission, rate limiting, payment idempotency and job state"],
    ["Identity/data", "Firebase Authentication, App Check and Firestore", "Identity verification, account/credit records, export history and durable job metadata"],
    ["Storage", "Firebase Storage with signed downloads and expiry cleanup", "Shared source/export objects across API and workers; local VM storage is scratch only"],
    ["Build/release", "Docker, Cloud Build and Artifact Registry", "One immutable image used by API and workers"],
    ["Operations", "Cloud Logging/Monitoring, uptime checks, structured logs and optional Sentry", "Health, incident detection, release verification and error aggregation"],
    ["Networking/security", "HTTPS edge, Secret Manager, IAM, restricted origins and malware scanner", "Secure browser/API boundary and protected credentials"],
]
story.append(table(architecture, [28 * mm, 60 * mm, 88 * mm]))
story.append(Spacer(1, 5))
note(
    "Not included as a required production service: Cloud SQL, Kubernetes/GKE, GPU instances or a dedicated data warehouse. The inspected repository does not require them for the Year-1 captioning workflow. S3-compatible storage exists as an optional alternative, but the proposal uses Firebase Storage in line with the stated GCP/Firebase deployment.",
    PALE_BLUE,
)


section("6", "Equipment Specification and Cost")
story.append(P("6.1 One business laptop", "LCSub"))
laptop = [
    ["Specification", "Recommended minimum", "Reason"],
    ["Processor", "Current-generation Intel Core i5 or AMD Ryzen 5, 6 or more cores", "Development, demos, browser editing and office work"],
    ["Memory", "16 GB RAM", "Frontend/backend tools and browser multitasking"],
    ["Storage", "512 GB NVMe SSD", "Source code, test media and local builds"],
    ["Display", "15.6 inch FHD IPS", "Caption timing and visual review"],
    ["Graphics", "Integrated graphics acceptable", "Heavy production rendering is handled by GCP workers"],
    ["Other", "Wi-Fi 6, webcam, Windows 11, carry case and minimum 1-year warranty", "Business mobility and customer demonstrations"],
    ["Estimated cost", "₹70,000 including applicable tax", "Obtain GST vendor quotation before disbursement"],
]
story.append(table(laptop, [35 * mm, 69 * mm, 72 * mm]))
story.append(P("6.2 One desktop workstation including essential accessories", "LCSub"))
desktop = [
    ["Component", "Recommended specification", "Estimated allocation"],
    ["Desktop tower", "Current-generation Core i5/Ryzen 5; 32 GB RAM; 1 TB NVMe SSD; integrated graphics; reliable 550 W-class PSU", "₹50,000"],
    ["Monitor", "24 inch FHD IPS", "₹9,500"],
    ["UPS", "Approximately 1 kVA line-interactive", "₹4,500"],
    ["Keyboard and mouse", "Wired business set", "₹1,500"],
    ["External backup drive", "1 TB portable HDD/SSD class", "₹4,500"],
    ["Total desktop package", "No premium gaming GPU proposed", "₹70,000"],
]
story.append(table(desktop, [35 * mm, 100 * mm, 41 * mm], aligns=["LEFT", "LEFT", "RIGHT"]))


section("7", "Office Setup Requirement")
office = [
    ["Item", "User-provided basis", "Full Year-1", "Recommended MUDRA funding"],
    ["Rent", "₹15,000 per month", "₹1,80,000", "₹90,000 - first 6 months"],
    ["Security deposit", "Refundable deposit", "₹50,000", "₹50,000 - full"],
    ["Electricity", "₹5,000 per month", "₹60,000", "₹30,000 - first 6 months"],
    ["Internet", "₹500 per month", "₹6,000", "₹6,000 - 12 months"],
    ["Total", "", "₹2,96,000", "₹1,76,000"],
]
story.append(table(office, [37 * mm, 46 * mm, 43 * mm, 50 * mm], aligns=["LEFT", "LEFT", "RIGHT", "RIGHT"], row_bgs={5: PALE_BLUE}))
story.append(P(
    "The deposit is a project funding requirement but not an operating expense. A signed rent agreement, deposit receipt and landlord KYC should support the claim. No office furniture is included because the scope limits equipment to one laptop and one desktop workstation."
))


section("8", "Google Cloud and Firebase Cost Estimate")
story.append(P(
    "The estimate follows the repository's actual GCP design. The current staging reference uses one API VM and one worker VM, each recorded as e2-standard-4 with 100 GiB balanced persistent disk, plus Basic 1 GiB Memorystore Redis and a Cloud Run frontend. Firebase provides Auth, Firestore and Storage. Costs are usage-dependent and must be verified in the Google Cloud Pricing Calculator before sanction/disbursement."
))

gcp_component = [
    ["Normal reference component", "Planning basis", "Indicative monthly amount"],
    ["API VM", "e2-standard-4, Mumbai, 24x7", "₹12,500"],
    ["Export/transcription worker VM", "e2-standard-4, Mumbai, 24x7", "₹12,500"],
    ["Memorystore Redis", "Basic 1 GiB", "₹3,800"],
    ["Persistent disks", "2 x 100 GiB balanced", "₹2,500"],
    ["Cloud Run frontend, build, registry, secrets and monitoring", "Low frontend traffic and controlled build/log retention", "₹1,000"],
    ["Firebase Storage/Firestore and network egress", "Short media retention; moderate export downloads", "₹2,000"],
    ["Normal reference total", "Approximate; includes planning FX/tax buffer", "₹34,300"],
]
story.append(table(gcp_component, [63 * mm, 72 * mm, 41 * mm], aligns=["LEFT", "LEFT", "RIGHT"], row_bgs={7: PALE_BLUE}))
story.append(Spacer(1, 5))

gcp_scenarios = [
    ["Scenario", "Operating assumption", "Monthly range", "12-month equivalent"],
    ["Low controlled launch", "Restricted pilot, right-sized or scheduled worker capacity, light storage/egress; not a mass-availability design", "₹10,000-₹15,000", "₹1,20,000-₹1,80,000"],
    ["Normal early-stage", "Separate API/worker, Basic Redis, normal monitoring, moderate media and downloads", "₹28,000-₹35,000", "₹3,36,000-₹4,20,000"],
    ["Higher usage", "Additional worker capacity, higher storage/egress and monitoring; requires load evidence", "₹50,000-₹65,000", "₹6,00,000-₹7,80,000"],
]
story.append(table(gcp_scenarios, [35 * mm, 79 * mm, 31 * mm, 31 * mm], aligns=["LEFT", "LEFT", "RIGHT", "RIGHT"]))
story.append(P("Year-1 graduated planning model", "LCSub"))
gcp_ramp = [
    ["Period", "Average monthly cloud budget", "3-month amount", "Reason"],
    ["Months 1-3", "₹12,000", "₹36,000", "Controlled launch and low utilisation"],
    ["Months 4-6", "₹20,000", "₹60,000", "Early customer use and longer worker uptime"],
    ["Months 7-9", "₹30,000", "₹90,000", "Growth and closer to separated steady-state footprint"],
    ["Months 10-12", "₹40,000", "₹1,20,000", "Expansion, egress and reliability headroom"],
    ["Total", "", "₹3,06,000", "Funded reserve covers first ₹1,00,000; balance from revenue/promoter funds"],
]
story.append(table(gcp_ramp, [33 * mm, 44 * mm, 36 * mm, 63 * mm], aligns=["LEFT", "RIGHT", "RIGHT", "LEFT"], row_bgs={5: PALE_GREEN}))


section("9", "OpenAI and Sarvam AI Cost Estimate")
story.append(P(
    "Repository routing is language-based: configured Indian languages use Sarvam's saaras:v3 speech-to-text path, while other supported languages use OpenAI whisper-1 with word timestamps. The application first extracts audio with FFmpeg. The following model assumes a 3-minute average video, gradual active-user growth and no duplicate billing for failed/uncertain provider calls."
))

usage = [
    ["Period", "Average active users", "Jobs/user/month", "Minutes/month", "3-month minutes"],
    ["Months 1-3", "75", "1.5", "338", "1,014"],
    ["Months 4-6", "150", "1.8", "810", "2,430"],
    ["Months 7-9", "250", "2.0", "1,500", "4,500"],
    ["Months 10-12", "400", "2.2", "2,640", "7,920"],
    ["Year 1", "Ramps toward 1,000 registered users", "", "", "15,864"],
]
story.append(table(usage, [34 * mm, 43 * mm, 36 * mm, 31 * mm, 32 * mm], aligns=["LEFT", "RIGHT", "RIGHT", "RIGHT", "RIGHT"], row_bgs={5: PALE_BLUE}))

api_calc = [
    ["Provider", "Share", "Usage basis", "Reference price used", "Estimated cost"],
    ["Sarvam AI STT", "60%", "9,518 minutes = 158.6 hours", "₹30 per hour", "₹4,758"],
    ["OpenAI Whisper", "40%", "6,346 minutes", "US$0.006 per minute; ₹90/US$ planning FX", "₹3,427"],
    ["Retry, translation and price buffer", "", "25% of base estimate", "Planning allowance", "₹2,046"],
    ["Normal Year-1 estimate", "", "", "Rounded", "₹11,000"],
    ["MUDRA reserve", "", "Higher activity, FX/tax and provider-price headroom", "Not a prepaid commitment", "₹20,000"],
]
story.append(table(api_calc, [32 * mm, 18 * mm, 50 * mm, 48 * mm, 28 * mm], aligns=["LEFT", "RIGHT", "LEFT", "LEFT", "RIGHT"], row_bgs={4: PALE_BLUE, 5: PALE_GREEN}))
note("All API costs are subject to actual usage and prevailing provider pricing. Obtain current OpenAI and Sarvam account pricing screenshots or pro-forma estimates before the bank relies on these figures.")


section("10", "Option A - Full 12-Month Office-Cost Approach")
option_a = [
    ["Use of funds", "Amount"],
    ["Laptop", "₹70,000"],
    ["Desktop workstation package", "₹70,000"],
    ["Office security deposit", "₹50,000"],
    ["Office rent - 12 months", "₹1,80,000"],
    ["Electricity - 12 months", "₹60,000"],
    ["Internet - 12 months", "₹6,000"],
    ["GCP/Firebase launch reserve", "₹24,000"],
    ["OpenAI/Sarvam reserve", "₹8,000"],
    ["Domain, email and essential software", "₹8,000"],
    ["Initial marketing", "₹14,000"],
    ["Contingency", "₹10,000"],
    ["Total", "₹5,00,000"],
]
story.append(table(option_a, [132 * mm, 44 * mm], aligns=["LEFT", "RIGHT"], row_bgs={12: PALE_BLUE}))
note(
    "Credit-officer challenge: ₹2,90,000 goes to deposit, rent and electricity, while only ₹32,000 is available for GCP/Firebase and transcription APIs. Given the actual worker/Redis/storage architecture, this allocation risks a funded office without enough productive infrastructure. Option A is therefore not recommended.",
    PALE_RED,
)


section("11", "Option B - Recommended MUDRA Kishore Funded Phase")
option_b_values = [70000, 70000, 50000, 90000, 30000, 6000, 100000, 20000, 12000, 25000, 27000]
assert sum(option_b_values) == 500000
option_b = [
    ["Use of funds", "Classification", "Amount", "% of loan"],
    ["Laptop", "Fixed asset", "₹70,000", "14.0%"],
    ["Desktop workstation package", "Fixed asset", "₹70,000", "14.0%"],
    ["Office security deposit", "Refundable deposit", "₹50,000", "10.0%"],
    ["Office rent - first 6 months", "Working capital", "₹90,000", "18.0%"],
    ["Electricity - first 6 months", "Working capital", "₹30,000", "6.0%"],
    ["Internet - 12 months", "Working capital", "₹6,000", "1.2%"],
    ["GCP/Firebase initial reserve", "Technology working capital", "₹1,00,000", "20.0%"],
    ["OpenAI/Sarvam reserve", "Technology working capital", "₹20,000", "4.0%"],
    ["Domain, business email and essential software", "Working capital", "₹12,000", "2.4%"],
    ["Lean launch marketing", "Working capital", "₹25,000", "5.0%"],
    ["Operational contingency", "Working capital", "₹27,000", "5.4%"],
    ["Total proposed bank finance", "PMMY - MUDRA Kishore", "₹5,00,000", "100.0%"],
]
story.append(table(option_b, [61 * mm, 51 * mm, 34 * mm, 30 * mm], aligns=["LEFT", "LEFT", "RIGHT", "RIGHT"], row_bgs={12: PALE_GREEN}))
story.append(P(
    "Disbursement discipline: equipment against GST invoices; office payments against agreement/receipts; cloud and API expenditure against provider invoices or controlled account credits; marketing against documented campaign invoices; contingency only for project-related operating needs with bank acceptance."
))


section("12", "First-Year Operating Cost and Monthly Burn")
burn = [
    ["Cost head", "Months 1-3", "Months 4-6", "Months 7-9", "Months 10-12", "Year 1"],
    ["Rent, electricity and internet", "₹61,500", "₹61,500", "₹61,500", "₹61,500", "₹2,46,000"],
    ["GCP/Firebase", "₹36,000", "₹60,000", "₹90,000", "₹1,20,000", "₹3,06,000"],
    ["OpenAI/Sarvam", "₹1,000", "₹2,000", "₹3,000", "₹5,000", "₹11,000"],
    ["Launch marketing", "₹10,000", "₹7,000", "₹5,000", "₹3,000", "₹25,000"],
    ["Domain/email/software", "₹4,000", "₹3,000", "₹3,000", "₹2,000", "₹12,000"],
    ["Maintenance/admin support", "₹3,000", "₹5,000", "₹7,000", "₹9,000", "₹24,000"],
    ["Quarterly operating burn", "₹1,15,500", "₹1,38,500", "₹1,69,500", "₹2,00,500", "₹6,24,000"],
    ["Average monthly burn", "₹38,500", "₹46,167", "₹56,500", "₹66,833", "₹52,000"],
]
story.append(table(burn, [47 * mm, 26 * mm, 26 * mm, 26 * mm, 26 * mm, 25 * mm], aligns=["LEFT", "RIGHT", "RIGHT", "RIGHT", "RIGHT", "RIGHT"], row_bgs={7: PALE_BLUE, 8: PALE_GOLD}))
story.append(P(
    "Founder remuneration, drawings, income tax and GST remittances are excluded. The business is assumed to be founder-operated in Year 1; any hiring requires a revised cash-flow plan. Hardware purchases and the refundable deposit are project outlays but are excluded from the operating-burn table."
))


section("13", "Fixed Asset Table")
fixed_assets = [
    ["Asset", "Qty.", "Unit estimate", "Amount", "Useful role"],
    ["Business laptop", "1", "₹70,000", "₹70,000", "Development, administration, demos and mobile work"],
    ["Desktop workstation package", "1", "₹70,000", "₹70,000", "Local QA, media testing and primary office workstation"],
    ["Total fixed assets", "2", "", "₹1,40,000", "28% of recommended bank finance"],
]
story.append(table(fixed_assets, [42 * mm, 16 * mm, 31 * mm, 30 * mm, 57 * mm], aligns=["LEFT", "CENTER", "RIGHT", "RIGHT", "LEFT"], row_bgs={3: PALE_BLUE}))


section("14", "Working Capital Table - Recommended Phase")
working_capital = [
    ["Working-capital purpose", "Amount"],
    ["Refundable office deposit", "₹50,000"],
    ["Six months rent and electricity", "₹1,20,000"],
    ["Twelve months internet", "₹6,000"],
    ["GCP/Firebase reserve", "₹1,00,000"],
    ["OpenAI/Sarvam reserve", "₹20,000"],
    ["Domain/email/software", "₹12,000"],
    ["Lean launch marketing", "₹25,000"],
    ["Operational contingency", "₹27,000"],
    ["Total working-capital/deposit provision", "₹3,60,000"],
]
story.append(table(working_capital, [132 * mm, 44 * mm], aligns=["LEFT", "RIGHT"], row_bgs={9: PALE_GREEN}))


section("15", "Full First-Year Project Cost Statement")
full_cost_values = [140000, 50000, 246000, 306000, 11000, 12000, 25000, 24000, 25000]
assert sum(full_cost_values) == 839000
full_cost = [
    ["Cost category", "Forward Year-1 requirement", "Treatment"],
    ["Laptop and desktop workstation", "₹1,40,000", "Fixed assets"],
    ["Office security deposit", "₹50,000", "Refundable project deposit"],
    ["12-month rent, electricity and internet", "₹2,46,000", "User-provided operating cost"],
    ["GCP/Firebase graduated Year-1 plan", "₹3,06,000", "Repository-derived estimated expenditure"],
    ["OpenAI/Sarvam normal usage estimate", "₹11,000", "Usage-dependent estimated expenditure"],
    ["Domain, email and essential software", "₹12,000", "Estimated expenditure"],
    ["Lean launch marketing", "₹25,000", "Estimated expenditure"],
    ["Maintenance/admin support", "₹24,000", "Estimated expenditure"],
    ["Project contingency", "₹25,000", "Reserve"],
    ["Forward Year-1 requirement", "₹8,39,000", "Excludes prior promoter investment"],
    ["Prior promoter investment", "₹50,000", "Already invested; disclosed separately"],
    ["Total economic project through Year 1", "₹8,89,000", "Forward requirement plus prior investment"],
]
story.append(table(full_cost, [74 * mm, 43 * mm, 59 * mm], aligns=["LEFT", "RIGHT", "LEFT"], row_bgs={10: PALE_BLUE, 12: PALE_GREEN}))
story.append(P(
    "The bank-funded phase is intentionally smaller than the full Year-1 requirement. The ₹3,39,000 forward shortfall beyond the ₹5,00,000 facility is to be met from operating revenue and additional promoter funds as customer usage grows. This avoids over-financing recurring costs at launch."
))


section("16", "Means of Finance")
means = [
    ["Source", "Amount", "Status / condition"],
    ["Proposed Indian Bank PMMY - MUDRA Kishore facility", "₹5,00,000", "Subject to appraisal and sanction"],
    ["Promoter investment already made", "₹50,000", "Prior product/pre-launch expenditure; not part of bank utilisation"],
    ["Future business revenue / additional promoter funding", "₹3,39,000", "To meet the balance forward Year-1 requirement progressively"],
    ["Total resources for economic project through Year 1", "₹8,89,000", "Includes prior investment"],
]
story.append(table(means, [75 * mm, 35 * mm, 66 * mm], aligns=["LEFT", "RIGHT", "LEFT"], row_bgs={4: PALE_GREEN}))


section("17", "First-Year Revenue Projection")
story.append(P(
    "Pricing assumption: ₹2,500 / ₹4,500 / ₹6,500 per paid customer per month, assumed exclusive of GST for this model. Customer mix is 60% / 30% / 10%, producing weighted average monthly revenue of ₹3,500 per payer. Prices and billing cadence must be finalised commercially before launch."
))
revenue = [
    ["Period", "Paying customers by month", "Average payers", "Quarter revenue", "Growth interpretation"],
    ["Months 1-3", "5 / 8 / 11", "8", "₹84,000", "Launch and early customers"],
    ["Months 4-6", "14 / 18 / 22", "18", "₹1,89,000", "Initial growth"],
    ["Months 7-9", "26 / 30 / 34", "30", "₹3,15,000", "Expansion"],
    ["Months 10-12", "38 / 45 / 52", "45", "₹4,72,500", "Increased acquisition"],
    ["Year 1", "52 paying at year-end", "25.25 average", "₹10,60,500", "Only 5.2% of 1,000 registered-user target pays by year-end"],
]
story.append(table(revenue, [32 * mm, 39 * mm, 28 * mm, 32 * mm, 45 * mm], aligns=["LEFT", "LEFT", "RIGHT", "RIGHT", "LEFT"], row_bgs={5: PALE_GREEN}))
note("This is a conservative planning projection, not a sales guarantee. It does not assume 1,000 paying customers from launch. If the final prices are GST-inclusive, revenue must be restated net of GST before credit appraisal.")


section("18", "First-Year Profitability Estimate")
profit = [
    ["Particular", "Year 1"],
    ["Projected operating revenue", "₹10,60,500"],
    ["Less: operating expenses", "₹6,24,000"],
    ["Estimated EBITDA / cash operating surplus", "₹4,36,500"],
    ["Less: indicative depreciation on computer assets at 20%", "₹28,000"],
    ["Operating profit before finance cost and tax", "₹4,08,500"],
]
story.append(table(profit, [132 * mm, 44 * mm], aligns=["LEFT", "RIGHT"], row_bgs={3: PALE_GREEN, 5: PALE_BLUE}))
story.append(P(
    "Interest, processing fees, income tax, promoter drawings and GST are not included. Interest rate and repayment terms are subject to Indian Bank sanction. Final profitability should be updated using sanctioned finance terms and actual vendor/provider quotations."
))


section("19", "Loan Repayment Capacity")
story.append(P(
    "The projected annual cash operating surplus before finance cost is ₹4,36,500, averaging approximately ₹36,375 per month across the year. The ramp is uneven: Months 1-3 are expected to run at an operating deficit of about ₹31,500 in aggregate, while Months 4-12 generate progressively higher surplus. The MUDRA-funded working-capital reserve is intended to bridge this launch period."
))
capacity = [
    ["Period", "Revenue", "Operating burn", "Surplus / (deficit) before finance"],
    ["Months 1-3", "₹84,000", "₹1,15,500", "(₹31,500)"],
    ["Months 4-6", "₹1,89,000", "₹1,38,500", "₹50,500"],
    ["Months 7-9", "₹3,15,000", "₹1,69,500", "₹1,45,500"],
    ["Months 10-12", "₹4,72,500", "₹2,00,500", "₹2,72,000"],
    ["Year 1", "₹10,60,500", "₹6,24,000", "₹4,36,500"],
]
story.append(table(capacity, [38 * mm, 39 * mm, 44 * mm, 55 * mm], aligns=["LEFT", "RIGHT", "RIGHT", "RIGHT"], row_bgs={5: PALE_GREEN}))
note(
    "No DSCR is stated because the interest rate, repayment tenure, instalment frequency and moratorium have not been sanctioned. Indian Bank should compute debt service after fixing those terms. Repayment ability depends on achieving the stated conversion and controlling cloud spend through budgets, alerts and usage limits.",
    PALE_BLUE,
)


section("20", "Vendor Quotation and Evidence Checklist")
checklist = [
    ["Item", "Supporting evidence required", "Status in this report"],
    ["Laptop", "Current GST quotation showing model, specification, warranty and tax", "Estimate only"],
    ["Desktop package", "Itemised GST quotation for tower, monitor, UPS, keyboard/mouse and backup drive", "Estimate only"],
    ["Office rent/deposit", "Draft/signed rent agreement, landlord KYC, deposit and rent receipts", "User-provided figures"],
    ["Electricity/internet", "Recent bill or service quotation for the proposed premises", "User-provided figures"],
    ["Google Cloud/Firebase", "Pricing Calculator export, billing account estimate and applicable India tax treatment", "Planning estimate; external verification required"],
    ["OpenAI", "Official pricing page/account estimate and currency/tax basis", "Reference rate used; verify before sanction"],
    ["Sarvam AI", "Official pricing page/account estimate or provider email quotation", "Reference rate used; verify before sanction"],
    ["Domain/business email/software", "Registrar and subscription screenshots/pro-forma invoices", "Estimate only"],
    ["Marketing", "Platform/media plan or agency quotation; campaign-wise spend cap", "Lean provision only"],
    ["Registrations", "Udyam and GST certificates; PAN; proprietorship/bank KYC", "Promoter to attach"],
    ["Banking", "Application form, account statements, ITR/GST returns if available, CIBIL and declarations", "As required by Indian Bank"],
]
story.append(table(checklist, [39 * mm, 92 * mm, 45 * mm]))


section("21", "Assumptions and Classification of Inputs")
assumptions = [
    ["Category", "Included assumptions / facts"],
    ["User-provided figures", "Legal name, constitution, product, bank, registrations, promoter profile, prior investment, proposed prices, 1,000-user target, rent ₹15,000/month, deposit ₹50,000, electricity ₹5,000/month and internet ₹500/month."],
    ["Repository-derived requirements", "React/Vite and Next.js frontends; FastAPI; Docker; FFmpeg/Chromium; Firebase Auth/App Check/Firestore/Storage; Redis/RQ; separate export/transcription queues; OpenAI and Sarvam; Cloud Build/Artifact Registry; Compute Engine/Cloud Run; signed media, expiry cleanup, monitoring and optional Sentry."],
    ["Estimated future expenditure", "Equipment prices, gradual cloud ramp, AI volume, software, marketing, maintenance/admin, contingency and customer conversion."],
    ["External pricing requiring verification", "GCP regional SKUs, egress, taxes, OpenAI/Sarvam rates, hardware/vendor prices, domain/email/software subscriptions and office evidence."],
    ["Commercial assumptions", "Three plan prices treated as monthly and exclusive of GST; weighted ARPU ₹3,500; 52 paying customers by Month 12; no employees or promoter salary in Year 1."],
    ["Finance assumptions", "₹5 lakh requested as Kishore; interest, margin, repayment, security/guarantee and disbursement are not invented and remain subject to Indian Bank sanction."],
]
story.append(table(assumptions, [45 * mm, 131 * mm]))


section("22", "Credit-Officer Review and Final Recommendation")
review = [
    ["Credit question", "Review finding", "Revision / safeguard"],
    ["Is each expense required?", "Hardware, office, queue-backed cloud, AI and launch marketing directly support operations or sales.", "Removed premium GPU, excess laptops and non-repository services."],
    ["Any duplication?", "External backup is inside the desktop package; Firebase/Google services are separated by role.", "No separate duplicate storage or workstation accessory line."],
    ["Any inflation?", "Hardware capped at ₹70,000 each; marketing reduced to ₹25,000; API estimate is usage-based.", "Require GST quotes and provider pricing evidence."],
    ["Does cloud match architecture?", "Yes. Compute, Redis/RQ, Firebase, build/registry, storage, logs and egress are repository-backed.", "No Cloud SQL, GKE or GPU added."],
    ["Can the business operate in Year 1?", "Yes, if launch is controlled and costs beyond the funded reserve are met from revenue/promoter funds.", "Use spend alerts, queue limits and staged worker capacity."],
    ["Are recurring office costs too high?", "Yes under Option A: office/deposit/power absorbs 58% of the facility.", "Option B funds six months of rent/power and directs 24% to cloud/API."],
    ["Is repayment plausible?", "Projected EBITDA is positive but Q1 is loss-making and revenue is not guaranteed.", "Bank to set terms after appraisal; monitor monthly paying users, cloud cost and collections."],
]
story.append(table(review, [42 * mm, 67 * mm, 67 * mm]))
story.append(Spacer(1, 7))
note(
    "Final recommendation: sanction consideration under PMMY - MUDRA Kishore up to ₹5,00,000 using Option B, subject to normal KYC/credit appraisal, satisfactory vendor quotations, office documentation, provider pricing evidence and a bank-approved disbursement schedule. Interest rate and repayment terms subject to Indian Bank sanction.",
    PALE_GREEN,
)


section("23", "Sources and Verification References")
sources = [
    ["Reference", "Use in estimate"],
    ["Department of Financial Services - PMMY", '<link href="https://financialservices.gov.in/pradhan-mantri-mudra-yojana-pmmy" color="#123A63">Kishore threshold and PMMY features</link>'],
    ["Indian Bank - PMMY information", '<link href="https://www.indianbank.in/slbc/centralGovtSponser.php" color="#123A63">Eligible borrowers and term-loan/working-capital purpose</link>'],
    ["Google Cloud - Compute pricing", '<link href="https://cloud.google.com/products/compute/pricing" color="#123A63">VM pricing basis; final regional calculator required</link>'],
    ["Google Cloud - Memorystore pricing", '<link href="https://cloud.google.com/memorystore/docs/redis/pricing" color="#123A63">Basic Redis reference pricing</link>'],
    ["Firebase pricing", '<link href="https://firebase.google.com/pricing" color="#123A63">Authentication, Firestore and Storage quotas/billing</link>'],
    ["OpenAI Whisper model", '<link href="https://developers.openai.com/api/docs/models/whisper-1" color="#123A63">US$0.006 per transcription minute reference</link>'],
    ["Sarvam API pricing", '<link href="https://docs.sarvam.ai/api/getting-started/pricing" color="#123A63">₹30 per hour speech-to-text reference</link>'],
    ["Lekha Captions repository review", "README, deployment notes, Docker/config files, backend queue/transcription/storage code and GCP staging records inspected on 12 September 2026."],
]
source_rows = [[P(x, "LCTableBold" if i == 0 else "LCTable") if not (i > 0 and j == 1 and "<link" in x) else Paragraph(x, styles["LCTable"]) for j, x in enumerate(row)] for i, row in enumerate(sources)]
source_table = Table(source_rows, colWidths=[60 * mm, 116 * mm], repeatRows=1)
source_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), BLUE),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("GRID", (0, 0), (-1, -1), 0.35, HexColor("#CBD5E1")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("BACKGROUND", (0, 2), (-1, 2), LIGHT_GREY),
    ("BACKGROUND", (0, 4), (-1, 4), LIGHT_GREY),
    ("BACKGROUND", (0, 6), (-1, 6), LIGHT_GREY),
    ("BACKGROUND", (0, 8), (-1, 8), LIGHT_GREY),
]))
story.append(source_table)


story.append(PageBreak())
section("24", "Declaration and Sign-Off")
story.append(P(
    "This document is a project cost estimate prepared from promoter-provided information, a review of the Lekha Captions repository and publicly available provider pricing. It is not a vendor quotation, tax invoice, bank sanction, legal opinion or guarantee of revenue. Actual expenditure will be supported by genuine quotations/invoices and may vary with usage, exchange rates, taxes and supplier pricing."
))
story.append(Spacer(1, 14 * mm))
sign = Table([
    [P("For Shiv Shakti Enterprises", "LCMini"), P("Received / reviewed by", "LCMini")],
    [Spacer(1, 18 * mm), Spacer(1, 18 * mm)],
    [P("Abhishek Naidu<br/>Proprietor<br/>Date: __________________", "LCBodySmall"), P("Indian Bank<br/>Branch / Officer: __________________<br/>Date: __________________", "LCBodySmall")],
], colWidths=[88 * mm, 88 * mm])
sign.setStyle(TableStyle([
    ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
    ("INNERGRID", (0, 0), (-1, -1), 0.35, HexColor("#CBD5E1")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
]))
story.append(sign)


doc = ReportDoc(str(OUTPUT))
doc.build(story)
print(OUTPUT)

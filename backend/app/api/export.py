"""
Export a notebook (sources + full chat transcript with citations) as
JSON, Markdown, or PDF, so a user can save/share their work outside the
app without needing any auth/sharing infrastructure.
"""
import io
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, StreamingResponse
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, ListFlowable, ListItem
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_owned_notebook
from app.core.db import get_db
from app.models.models import Chunk, Citation, Message, Notebook, Source

router = APIRouter(prefix="/notebooks/{notebook_id}/export", tags=["export"])


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "notebook"


def _describe_location(chunk: Chunk) -> str:
    if chunk.page is not None:
        return f"page {chunk.page}"
    if chunk.timestamp_start is not None:
        m, s = divmod(int(chunk.timestamp_start), 60)
        return f"{m}:{s:02d}"
    if chunk.section:
        return f"section '{chunk.section}'"
    return "excerpt"


async def _load_export_data(db: AsyncSession, notebook: Notebook):
    sources = (
        (await db.execute(select(Source).where(Source.notebook_id == notebook.id).order_by(Source.created_at)))
        .scalars()
        .all()
    )

    messages = (
        await db.execute(
            select(Message)
            .where(Message.notebook_id == notebook.id)
            .options(selectinload(Message.citations).selectinload(Citation.chunk).selectinload(Chunk.source))
            .order_by(Message.created_at)
        )
    ).scalars().all()

    return notebook, sources, messages


@router.get("")
async def export_notebook(
    notebook_id: uuid.UUID,
    format: str = Query("markdown", pattern="^(json|markdown|pdf)$"),
    db: AsyncSession = Depends(get_db),
    notebook: Notebook = Depends(get_owned_notebook),
):
    notebook, sources, messages = await _load_export_data(db, notebook)
    slug = _slugify(notebook.name)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if format == "json":
        return _export_json(notebook, sources, messages, slug, timestamp)
    if format == "pdf":
        return _export_pdf(notebook, sources, messages, slug, timestamp)
    return _export_markdown(notebook, sources, messages, slug, timestamp)


# ---------------------------------------------------------------- JSON ----
def _export_json(notebook, sources, messages, slug, timestamp) -> Response:
    payload = {
        "notebook": {
            "id": str(notebook.id),
            "name": notebook.name,
            "description": notebook.description,
            "created_at": notebook.created_at.isoformat(),
        },
        "sources": [
            {
                "id": str(s.id),
                "type": s.type.value,
                "title": s.title,
                "origin": s.origin,
                "status": s.status.value,
            }
            for s in sources
        ],
        "conversation": [
            {
                "role": m.role.value,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
                "citations": [
                    {
                        "marker": c.marker_index,
                        "source_title": c.chunk.source.title,
                        "location": _describe_location(c.chunk),
                        "excerpt": c.chunk.content,
                    }
                    for c in sorted(m.citations, key=lambda c: c.marker_index)
                ],
            }
            for m in messages
        ],
    }
    import json as _json

    body = _json.dumps(payload, indent=2)
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{slug}-{timestamp}.json"'},
    )


# ------------------------------------------------------------ Markdown ----
def _build_markdown(notebook, sources, messages) -> str:
    lines = [f"# {notebook.name}", ""]
    if notebook.description:
        lines += [notebook.description, ""]
    lines += [f"_Exported {datetime.now(timezone.utc).strftime('%B %d, %Y')}_", ""]

    lines += ["## Sources", ""]
    if not sources:
        lines += ["_No sources yet._", ""]
    else:
        for s in sources:
            lines.append(f"- **{s.title}** ({s.type.value}) — {s.status.value}")
        lines.append("")

    lines += ["## Conversation", ""]
    if not messages:
        lines += ["_No questions asked yet._", ""]
    else:
        for m in messages:
            speaker = "**You**" if m.role.value == "user" else "**Assistant**"
            lines += [f"{speaker}: {m.content}", ""]
            citations = sorted(m.citations, key=lambda c: c.marker_index)
            if citations:
                lines.append("Sources:")
                for c in citations:
                    loc = _describe_location(c.chunk)
                    lines.append(f"- [{c.marker_index}] {c.chunk.source.title} ({loc})")
                lines.append("")

    return "\n".join(lines)


def _export_markdown(notebook, sources, messages, slug, timestamp) -> Response:
    body = _build_markdown(notebook, sources, messages)
    return Response(
        content=body,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{slug}-{timestamp}.md"'},
    )


# ----------------------------------------------------------------- PDF ----
def _export_pdf(notebook, sources, messages, slug, timestamp) -> StreamingResponse:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        leftMargin=0.9 * inch,
        rightMargin=0.9 * inch,
        topMargin=0.9 * inch,
        bottomMargin=0.9 * inch,
        title=notebook.name,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("NBTitle", parent=styles["Title"], spaceAfter=4)
    meta_style = ParagraphStyle("NBMeta", parent=styles["Normal"], textColor="#666666", spaceAfter=16)
    h2_style = ParagraphStyle("NBH2", parent=styles["Heading2"], spaceBefore=18, spaceAfter=8)
    body_style = ParagraphStyle("NBBody", parent=styles["Normal"], spaceAfter=10, leading=15)
    speaker_style = ParagraphStyle("NBSpeaker", parent=styles["Normal"], fontName="Helvetica-Bold", spaceAfter=2)
    citation_style = ParagraphStyle("NBCitation", parent=styles["Normal"], fontSize=9, textColor="#666666")

    def esc(text: str) -> str:
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    story = [Paragraph(esc(notebook.name), title_style)]
    if notebook.description:
        story.append(Paragraph(esc(notebook.description), meta_style))
    story.append(Paragraph(f"Exported {datetime.now(timezone.utc).strftime('%B %d, %Y')}", meta_style))

    story.append(Paragraph("Sources", h2_style))
    if not sources:
        story.append(Paragraph("No sources yet.", body_style))
    else:
        items = [
            ListItem(Paragraph(f"<b>{esc(s.title)}</b> ({s.type.value}) — {s.status.value}", body_style))
            for s in sources
        ]
        story.append(ListFlowable(items, bulletType="bullet"))

    story.append(Paragraph("Conversation", h2_style))
    if not messages:
        story.append(Paragraph("No questions asked yet.", body_style))
    else:
        for m in messages:
            speaker = "You" if m.role.value == "user" else "Assistant"
            story.append(Paragraph(speaker, speaker_style))
            story.append(Paragraph(esc(m.content).replace("\n", "<br/>"), body_style))
            citations = sorted(m.citations, key=lambda c: c.marker_index)
            for c in citations:
                loc = _describe_location(c.chunk)
                story.append(
                    Paragraph(f"[{c.marker_index}] {esc(c.chunk.source.title)} ({loc})", citation_style)
                )
            story.append(Spacer(1, 8))

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{slug}-{timestamp}.pdf"'},
    )

"""more job boards: SmartRecruiters and Workday

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-18

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD = ("greenhouse", "lever", "ashby")
NEW = (*OLD, "smartrecruiters", "workday")

# Checked live on 18 Oct 2026: each feed answered with postings.
BOARDS = [
    ("smartrecruiters", "Freshworks", "Freshworks"),
    ("smartrecruiters", "Cars24", "CARS24"),
    ("smartrecruiters", "Experian", "Experian"),
    ("smartrecruiters", "ServiceNow", "ServiceNow"),
    ("smartrecruiters", "LinkedIn3", "LinkedIn"),
    ("smartrecruiters", "Grab", "Grab"),
    ("smartrecruiters", "Canva", "Canva"),
    ("workday", "nvidia.wd5/NVIDIAExternalCareerSite", "NVIDIA"),
    ("workday", "adobe.wd5/external_experienced", "Adobe"),
    ("workday", "salesforce.wd12/External_Career_Site", "Salesforce"),
    ("workday", "mastercard.wd1/CorporateCareers", "Mastercard"),
    ("workday", "visa.wd5/Visa", "Visa"),
    ("workday", "paypal.wd1/jobs", "PayPal"),
    ("workday", "autodesk.wd1/Ext", "Autodesk"),
    ("workday", "cisco.wd5/Cisco_Careers", "Cisco"),
    ("workday", "micron.wd1/External", "Micron"),
    ("workday", "target.wd5/targetcareers", "Target"),
    ("workday", "citi.wd5/2", "Citi"),
    ("workday", "workday.wd5/Workday", "Workday"),
    ("workday", "blackrock.wd1/BlackRock_Professional", "BlackRock"),
    ("workday", "accenture.wd103/AccentureCareers", "Accenture"),
]


def _constraint(providers: tuple[str, ...]) -> None:
    op.drop_constraint("ck_company_boards_provider_known", "company_boards", schema="app")
    op.create_check_constraint(
        "provider_known",
        "company_boards",
        f"provider IN {providers}",
        schema="app",
    )


def upgrade() -> None:
    _constraint(NEW)
    boards = sa.table(
        "company_boards",
        sa.column("provider", sa.Text),
        sa.column("slug", sa.Text),
        sa.column("company_name", sa.Text),
        schema="app",
    )
    op.bulk_insert(boards, [{"provider": p, "slug": s, "company_name": n} for p, s, n in BOARDS])


def downgrade() -> None:
    op.execute("DELETE FROM app.company_boards WHERE provider IN ('smartrecruiters', 'workday')")
    _constraint(OLD)

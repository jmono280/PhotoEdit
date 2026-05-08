"""add overlay_path to edit_batches

Revision ID: c7e2d4f1b839
Revises: bd6c39a6c722
Create Date: 2026-05-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7e2d4f1b839'
down_revision: Union[str, None] = 'bd6c39a6c722'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('edit_batches', sa.Column('overlay_path', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('edit_batches', 'overlay_path')

"""add_weight_entries_table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-14 21:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()

    if 'weight_entries' not in table_names:
        op.create_table(
            'weight_entries',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            sa.Column('weight_kg', sa.Float(), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_weight_entries_user_id', 'weight_entries', ['user_id'], unique=False)
        op.create_index('ix_weight_entries_date', 'weight_entries', ['date'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()

    if 'weight_entries' in table_names:
        indexes = [idx['name'] for idx in inspector.get_indexes('weight_entries')]
        if 'ix_weight_entries_date' in indexes:
            op.drop_index('ix_weight_entries_date', table_name='weight_entries')
        if 'ix_weight_entries_user_id' in indexes:
            op.drop_index('ix_weight_entries_user_id', table_name='weight_entries')
        op.drop_table('weight_entries')

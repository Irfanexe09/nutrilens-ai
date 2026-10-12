"""add_password_reset_and_token_version

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-12 23:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('password_reset_token_hash', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('password_reset_expires_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('token_version', sa.Integer(), nullable=False, server_default='1'))
        batch_op.create_index('ix_users_password_reset_token_hash', ['password_reset_token_hash'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index('ix_users_password_reset_token_hash')
        batch_op.drop_column('token_version')
        batch_op.drop_column('password_reset_expires_at')
        batch_op.drop_column('password_reset_token_hash')

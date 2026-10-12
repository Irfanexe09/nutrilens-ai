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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col['name'] for col in inspector.get_columns('users')]
    existing_indexes = [idx['name'] for idx in inspector.get_indexes('users')]

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'password_reset_token_hash' not in existing_columns:
            batch_op.add_column(sa.Column('password_reset_token_hash', sa.String(length=64), nullable=True))
        if 'password_reset_expires_at' not in existing_columns:
            batch_op.add_column(sa.Column('password_reset_expires_at', sa.DateTime(), nullable=True))
        if 'token_version' not in existing_columns:
            batch_op.add_column(sa.Column('token_version', sa.Integer(), nullable=False, server_default='1'))
        if 'ix_users_password_reset_token_hash' not in existing_indexes:
            batch_op.create_index('ix_users_password_reset_token_hash', ['password_reset_token_hash'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col['name'] for col in inspector.get_columns('users')]
    existing_indexes = [idx['name'] for idx in inspector.get_indexes('users')]

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'ix_users_password_reset_token_hash' in existing_indexes:
            batch_op.drop_index('ix_users_password_reset_token_hash')
        if 'token_version' in existing_columns:
            batch_op.drop_column('token_version')
        if 'password_reset_expires_at' in existing_columns:
            batch_op.drop_column('password_reset_expires_at')
        if 'password_reset_token_hash' in existing_columns:
            batch_op.drop_column('password_reset_token_hash')

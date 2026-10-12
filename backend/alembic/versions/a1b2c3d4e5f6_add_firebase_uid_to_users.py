"""add_firebase_uid_to_users

Revision ID: a1b2c3d4e5f6
Revises: 4e07a1b66416
Create Date: 2026-10-12 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '4e07a1b66416'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col['name'] for col in inspector.get_columns('users')]
    existing_indexes = [idx['name'] for idx in inspector.get_indexes('users')]

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'firebase_uid' not in existing_columns:
            batch_op.add_column(sa.Column('firebase_uid', sa.String(length=128), nullable=True))
        if 'ix_users_firebase_uid' not in existing_indexes:
            batch_op.create_index('ix_users_firebase_uid', ['firebase_uid'], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col['name'] for col in inspector.get_columns('users')]
    existing_indexes = [idx['name'] for idx in inspector.get_indexes('users')]

    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'ix_users_firebase_uid' in existing_indexes:
            batch_op.drop_index('ix_users_firebase_uid')
        if 'firebase_uid' in existing_columns:
            batch_op.drop_column('firebase_uid')

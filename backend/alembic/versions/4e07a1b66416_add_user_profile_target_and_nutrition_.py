"""add_user_profile_target_and_nutrition_fields

Revision ID: 4e07a1b66416
Revises: 23ae96902881
Create Date: 2026-10-10 12:38:09.885883

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4e07a1b66416'
down_revision: Union[str, Sequence[str], None] = '23ae96902881'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'users' not in existing_tables:
        op.create_table('users',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    if 'daily_nutrition_targets' not in existing_tables:
        op.create_table('daily_nutrition_targets',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('bmr', sa.Float(), nullable=False),
        sa.Column('tdee', sa.Float(), nullable=False),
        sa.Column('calorie_target', sa.Float(), nullable=False),
        sa.Column('protein_target_g', sa.Float(), nullable=False),
        sa.Column('carbohydrates_target_g', sa.Float(), nullable=False),
        sa.Column('fat_target_g', sa.Float(), nullable=False),
        sa.Column('fiber_target_g', sa.Float(), nullable=False),
        sa.Column('safety_warning', sa.Text(), nullable=True),
        sa.Column('disclaimer', sa.String(length=500), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_daily_nutrition_targets_user_id'), 'daily_nutrition_targets', ['user_id'], unique=False)

    if 'user_profiles' not in existing_tables:
        op.create_table('user_profiles',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=True),
        sa.Column('age', sa.Integer(), nullable=False),
        sa.Column('sex', sa.String(length=20), nullable=False),
        sa.Column('height_cm', sa.Float(), nullable=False),
        sa.Column('weight_kg', sa.Float(), nullable=False),
        sa.Column('activity_level', sa.String(length=50), nullable=False),
        sa.Column('goal', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_user_profiles_user_id'), 'user_profiles', ['user_id'], unique=True)

    food_cols = [c['name'] for c in inspector.get_columns('food_items')]
    with op.batch_alter_table('food_items') as batch_op:
        if 'piece_weight_g' not in food_cols:
            batch_op.add_column(sa.Column('piece_weight_g', sa.Float(), nullable=True))
        if 'density_g_per_ml' not in food_cols:
            batch_op.add_column(sa.Column('density_g_per_ml', sa.Float(), nullable=True, server_default='1.0'))
        if 'allowed_units' not in food_cols:
            batch_op.add_column(sa.Column('allowed_units', sa.String(length=120), nullable=True, server_default='g,serving'))
        if 'data_source' not in food_cols:
            batch_op.add_column(sa.Column('data_source', sa.String(length=120), nullable=True, server_default='ICMR-NIN IFCT & USDA FoodData Central'))

    meal_item_cols = [c['name'] for c in inspector.get_columns('meal_items')]
    with op.batch_alter_table('meal_items') as batch_op:
        if 'gram_weight' not in meal_item_cols:
            batch_op.add_column(sa.Column('gram_weight', sa.Float(), nullable=True))
        if 'sugar' not in meal_item_cols:
            batch_op.add_column(sa.Column('sugar', sa.Float(), nullable=False, server_default='0.0'))
        if 'sodium' not in meal_item_cols:
            batch_op.add_column(sa.Column('sodium', sa.Float(), nullable=False, server_default='0.0'))

    meal_cols = [c['name'] for c in inspector.get_columns('meals')]
    meal_indexes = [i['name'] for i in inspector.get_indexes('meals')]
    meal_fks = [fk['name'] for fk in inspector.get_foreign_keys('meals')]
    with op.batch_alter_table('meals') as batch_op:
        if 'total_sugar' not in meal_cols:
            batch_op.add_column(sa.Column('total_sugar', sa.Float(), nullable=False, server_default='0.0'))
        if 'total_sodium' not in meal_cols:
            batch_op.add_column(sa.Column('total_sodium', sa.Float(), nullable=False, server_default='0.0'))
        if 'confidence_level' not in meal_cols:
            batch_op.add_column(sa.Column('confidence_level', sa.String(length=32), nullable=False, server_default='MEDIUM'))
        if 'parent_meal_id' not in meal_cols:
            batch_op.add_column(sa.Column('parent_meal_id', sa.String(length=36), nullable=True))
        if 'is_optimized_version' not in meal_cols:
            batch_op.add_column(sa.Column('is_optimized_version', sa.Boolean(), nullable=False, server_default='0'))
        if 'optimization_notes' not in meal_cols:
            batch_op.add_column(sa.Column('optimization_notes', sa.Text(), nullable=True))
        batch_op.alter_column('user_id',
                   existing_type=sa.VARCHAR(length=64),
                   type_=sa.String(length=36),
                   existing_nullable=True)
        if 'ix_meals_parent_meal_id' not in meal_indexes:
            batch_op.create_index(batch_op.f('ix_meals_parent_meal_id'), ['parent_meal_id'], unique=False)
        if 'fk_meals_user_id_users' not in meal_fks:
            batch_op.create_foreign_key('fk_meals_user_id_users', 'users', ['user_id'], ['id'], ondelete='SET NULL')
        if 'fk_meals_parent_meal_id_meals' not in meal_fks:
            batch_op.create_foreign_key('fk_meals_parent_meal_id_meals', 'meals', ['parent_meal_id'], ['id'], ondelete='SET NULL')
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('meals') as batch_op:
        batch_op.drop_constraint('fk_meals_parent_meal_id_meals', type_='foreignkey')
        batch_op.drop_constraint('fk_meals_user_id_users', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_meals_parent_meal_id'))
        batch_op.alter_column('user_id',
                   existing_type=sa.String(length=36),
                   type_=sa.VARCHAR(length=64),
                   existing_nullable=True)
        batch_op.drop_column('optimization_notes')
        batch_op.drop_column('is_optimized_version')
        batch_op.drop_column('parent_meal_id')
        batch_op.drop_column('confidence_level')
        batch_op.drop_column('total_sodium')
        batch_op.drop_column('total_sugar')

    with op.batch_alter_table('meal_items') as batch_op:
        batch_op.drop_column('sodium')
        batch_op.drop_column('sugar')
        batch_op.drop_column('gram_weight')

    with op.batch_alter_table('food_items') as batch_op:
        batch_op.drop_column('data_source')
        batch_op.drop_column('allowed_units')
        batch_op.drop_column('density_g_per_ml')
        batch_op.drop_column('piece_weight_g')
    op.drop_index(op.f('ix_user_profiles_user_id'), table_name='user_profiles')
    op.drop_table('user_profiles')
    op.drop_index(op.f('ix_daily_nutrition_targets_user_id'), table_name='daily_nutrition_targets')
    op.drop_table('daily_nutrition_targets')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    # ### end Alembic commands ###

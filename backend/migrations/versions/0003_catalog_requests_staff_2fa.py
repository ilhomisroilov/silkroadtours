"""Catalog (destinations, itineraries), service requests, staff notes and two-factor sign-in,
manual payments and refunds owed.

Revision ID: 0003
Revises: 0002
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0003'
down_revision: str | None = '0002'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CHECKS = [
    ("tours", "compare", "compare_at_price_minor IS NULL OR compare_at_price_minor > adult_price_minor"),
    ("tours", "audience", "audience IN ('inbound', 'domestic', 'outbound')"),
    ("tours", "category", "category IN ('cultural', 'adventure', 'gastronomy', 'pilgrimage', 'nature', 'city', 'family', "
                          "'luxury', 'other')"),
    ("tours", "duration", "duration_days BETWEEN 1 AND 60"),
    ("tours", "group", "min_group >= 1 AND max_group >= min_group"),
    ("tours", "cancel_days", "free_cancel_days BETWEEN 0 AND 365"),
    ("tours", "deposit", "deposit_percent IS NULL OR deposit_percent BETWEEN 0 AND 100"),
    ("bookings", "kind", "kind IN ('tour','custom')"),
]


def upgrade() -> None:
    op.create_table('destinations',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('slug', sa.String(length=160), nullable=False),
    sa.Column('i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('country', sa.String(length=2), nullable=False),
    sa.Column('lat', sa.Float(), nullable=True),
    sa.Column('lng', sa.Float(), nullable=True),
    sa.Column('hero_image', sa.String(length=500), nullable=True),
    sa.Column('best_months', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('is_published', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_destinations')),
    sa.UniqueConstraint('slug', name=op.f('uq_destinations_slug'))
    )
    op.create_table('mfa_challenges',
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_mfa_challenges_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('token_hash', name=op.f('pk_mfa_challenges'))
    )
    op.create_table('notes',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('entity', sa.String(length=16), nullable=False),
    sa.Column('entity_id', sa.Uuid(), nullable=False),
    sa.Column('author_id', sa.Uuid(), nullable=True),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], name=op.f('fk_notes_author_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_notes'))
    )
    op.create_index(op.f('ix_notes_entity_id'), 'notes', ['entity_id'], unique=False)
    op.create_table('user_mfa',
    sa.Column('user_id', sa.Uuid(), nullable=False),
    sa.Column('secret_encrypted', sa.String(length=400), nullable=False),
    sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_step', sa.Integer(), nullable=False),
    sa.Column('recovery_hashes', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_user_mfa_user_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id', name=op.f('pk_user_mfa'))
    )
    op.create_table('tour_days',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('tour_id', sa.Uuid(), nullable=False),
    sa.Column('day_no', sa.Integer(), nullable=False),
    sa.Column('i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('overnight', sa.String(length=120), nullable=True),
    sa.CheckConstraint('day_no >= 1', name=op.f('ck_tour_days_day_no')),
    sa.ForeignKeyConstraint(['tour_id'], ['tours.id'], name=op.f('fk_tour_days_tour_id_tours'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_tour_days')),
    sa.UniqueConstraint('tour_id', 'day_no', name='uq_tour_days_tour_day')
    )
    op.create_index(op.f('ix_tour_days_tour_id'), 'tour_days', ['tour_id'], unique=False)
    op.create_table('service_requests',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('reference', sa.String(length=16), nullable=False),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('user_id', sa.Uuid(), nullable=True),
    sa.Column('assigned_to', sa.Uuid(), nullable=True),
    sa.Column('booking_id', sa.Uuid(), nullable=True),
    sa.Column('full_name', sa.String(length=200), nullable=False),
    sa.Column('email', sa.String(length=254), nullable=False),
    sa.Column('phone', sa.String(length=32), nullable=False),
    sa.Column('contact_channel', sa.String(length=16), nullable=False),
    sa.Column('locale', sa.String(length=2), nullable=False),
    sa.Column('start_date', sa.Date(), nullable=True),
    sa.Column('end_date', sa.Date(), nullable=True),
    sa.Column('adults', sa.Integer(), nullable=False),
    sa.Column('children', sa.Integer(), nullable=False),
    sa.Column('budget_minor', sa.Integer(), nullable=True),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('message', sa.Text(), nullable=True),
    sa.Column('source', sa.String(length=64), nullable=True),
    sa.Column('first_response_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("kind IN ('hotel', 'transport', 'guide', 'custom_tour', 'visa', 'other')", name=op.f('ck_service_requests_kind')),
    sa.CheckConstraint("status IN ('new', 'in_progress', 'quoted', 'won', 'lost', 'cancelled')", name=op.f('ck_service_requests_status')),
    sa.CheckConstraint('adults >= 1 AND children >= 0', name=op.f('ck_service_requests_pax')),
    sa.ForeignKeyConstraint(['assigned_to'], ['users.id'], name=op.f('fk_service_requests_assigned_to_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], name=op.f('fk_service_requests_booking_id_bookings'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_service_requests_user_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_service_requests')),
    sa.UniqueConstraint('reference', name=op.f('uq_service_requests_reference'))
    )
    op.create_index(op.f('ix_service_requests_assigned_to'), 'service_requests', ['assigned_to'], unique=False)
    op.create_index(op.f('ix_service_requests_email'), 'service_requests', ['email'], unique=False)
    op.create_index('ix_service_requests_status', 'service_requests', ['status', 'created_at'], unique=False)
    op.create_index(op.f('ix_service_requests_user_id'), 'service_requests', ['user_id'], unique=False)
    op.add_column('bookings', sa.Column('kind', sa.String(length=16), nullable=False, server_default='tour'))
    op.add_column('bookings', sa.Column('free_cancel_until', sa.Date(), nullable=True))
    op.add_column('bookings', sa.Column('refund_due_minor', sa.Integer(), nullable=False, server_default='0'))
    op.create_index('ix_departures_start', 'departures', ['start_date', 'status'], unique=False)
    op.add_column('payments', sa.Column('method', sa.String(length=16), nullable=True))
    op.add_column('payments', sa.Column('external_reference', sa.String(length=120), nullable=True))
    op.add_column('payments', sa.Column('recorded_by', sa.Uuid(), nullable=True))
    op.create_foreign_key(op.f('fk_payments_recorded_by_users'), 'payments', 'users', ['recorded_by'], ['id'], ondelete='SET NULL')
    op.add_column('sessions', sa.Column('mfa_verified', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('tours', sa.Column('i18n', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'))
    op.add_column('tours', sa.Column('destination_id', sa.Uuid(), nullable=True))
    op.add_column('tours', sa.Column('audience', sa.String(length=16), nullable=False, server_default='inbound'))
    op.add_column('tours', sa.Column('category', sa.String(length=16), nullable=False, server_default='cultural'))
    op.add_column('tours', sa.Column('duration_days', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('tours', sa.Column('min_group', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('tours', sa.Column('max_group', sa.Integer(), nullable=False, server_default='16'))
    op.add_column('tours', sa.Column('compare_at_price_minor', sa.Integer(), nullable=True))
    op.add_column('tours', sa.Column('free_cancel_days', sa.Integer(), nullable=False, server_default='30'))
    op.add_column('tours', sa.Column('deposit_percent', sa.Integer(), nullable=True))
    op.add_column('tours', sa.Column('hero_image', sa.String(length=500), nullable=True))
    op.add_column('tours', sa.Column('gallery', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'))
    op.add_column('tours', sa.Column('season_months', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'))
    op.add_column('tours', sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('tours', sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_tours_destination_id'), 'tours', ['destination_id'], unique=False)
    op.create_index('ix_tours_listing', 'tours', ['is_active', 'audience', 'sort_order'], unique=False)
    op.create_foreign_key(op.f('fk_tours_destination_id_destinations'), 'tours', 'destinations', ['destination_id'], ['id'], ondelete='SET NULL')
    op.drop_constraint(op.f("ck_bookings_paid"), "bookings", type_="check")
    op.create_check_constraint(op.f("ck_bookings_paid"), "bookings", "paid_minor >= 0 AND refund_due_minor >= 0")
    op.drop_constraint(op.f("ck_payments_provider"), "payments", type_="check")
    op.create_check_constraint(op.f("ck_payments_provider"), "payments", "provider IN ('payme', 'click', 'manual')")
    for table, name, condition in CHECKS:
        op.create_check_constraint(op.f(f"ck_{table}_{name}"), table, condition)


def downgrade() -> None:
    for table, name, _ in CHECKS:
        op.drop_constraint(op.f(f"ck_{table}_{name}"), table, type_="check")
    op.execute("DELETE FROM payments WHERE provider = 'manual'")
    op.drop_constraint(op.f("ck_payments_provider"), "payments", type_="check")
    op.create_check_constraint(op.f("ck_payments_provider"), "payments", "provider IN ('payme', 'click')")
    op.drop_constraint(op.f("ck_bookings_paid"), "bookings", type_="check")
    op.create_check_constraint(op.f("ck_bookings_paid"), "bookings", "paid_minor >= 0")
    op.drop_constraint(op.f('fk_tours_destination_id_destinations'), 'tours', type_='foreignkey')
    op.drop_index('ix_tours_listing', table_name='tours')
    op.drop_index(op.f('ix_tours_destination_id'), table_name='tours')
    op.drop_column('tours', 'archived_at')
    op.drop_column('tours', 'sort_order')
    op.drop_column('tours', 'season_months')
    op.drop_column('tours', 'gallery')
    op.drop_column('tours', 'hero_image')
    op.drop_column('tours', 'deposit_percent')
    op.drop_column('tours', 'free_cancel_days')
    op.drop_column('tours', 'compare_at_price_minor')
    op.drop_column('tours', 'max_group')
    op.drop_column('tours', 'min_group')
    op.drop_column('tours', 'duration_days')
    op.drop_column('tours', 'category')
    op.drop_column('tours', 'audience')
    op.drop_column('tours', 'destination_id')
    op.drop_column('tours', 'i18n')
    op.drop_column('sessions', 'mfa_verified')
    op.drop_constraint(op.f('fk_payments_recorded_by_users'), 'payments', type_='foreignkey')
    op.drop_column('payments', 'recorded_by')
    op.drop_column('payments', 'external_reference')
    op.drop_column('payments', 'method')
    op.drop_index('ix_departures_start', table_name='departures')
    op.drop_column('bookings', 'refund_due_minor')
    op.drop_column('bookings', 'free_cancel_until')
    op.drop_column('bookings', 'kind')
    op.drop_index(op.f('ix_service_requests_user_id'), table_name='service_requests')
    op.drop_index('ix_service_requests_status', table_name='service_requests')
    op.drop_index(op.f('ix_service_requests_email'), table_name='service_requests')
    op.drop_index(op.f('ix_service_requests_assigned_to'), table_name='service_requests')
    op.drop_table('service_requests')
    op.drop_index(op.f('ix_tour_days_tour_id'), table_name='tour_days')
    op.drop_table('tour_days')
    op.drop_table('user_mfa')
    op.drop_index(op.f('ix_notes_entity_id'), table_name='notes')
    op.drop_table('notes')
    op.drop_table('mfa_challenges')
    op.drop_table('destinations')

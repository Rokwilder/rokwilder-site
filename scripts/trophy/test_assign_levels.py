"""Tie-friendly trophy ranks: equal top values all get Top. Thin/none rules stay."""
from build import assign_levels, assign_levels_legacy, level_of

def places(vals, n=20):
    return [{'place': f'p{i}', 'value': v, 'n': n} for i, v in enumerate(vals)]

def levels(recs):
    return [p['level'] for p in recs]

def test_all_tied_at_top_are_top():
    recs = places([100] * 15)
    assign_levels(recs)
    assert levels(recs) == ['top'] * 15, levels(recs)
    recs2 = places([100] * 15)
    assign_levels_legacy(recs2)
    # Old formula ranked an all-tie cluster at the bottom.
    assert 'top' not in levels(recs2)

def test_many_tied_at_100_rank_top():
    recs = places([100] * 8 + [40] * 12)
    assign_levels(recs)
    assert set(levels(recs[:8])) == {'top'}
    recs2 = places([100] * 8 + [40] * 12)
    assign_levels_legacy(recs2)
    # Wyoming-style case: many 100% scores used to land on Above average.
    assert set(levels(recs2[:8])) == {'above'}, levels(recs2[:8])
    assert set(levels(recs[:8])) == {'top'}

def test_thin_and_none_unchanged():
    recs = [
        {'place': 'a', 'value': 100, 'n': 6},
        {'place': 'b', 'value': None, 'n': 20},
        {'place': 'c', 'value': 80, 'n': 20},
        {'place': 'd', 'value': 70, 'n': 20},
        {'place': 'e', 'value': 60, 'n': 20},
        {'place': 'f', 'value': 50, 'n': 20},
    ]
    assign_levels(recs)
    assert recs[0]['level'] == 'thin'
    assert recs[1]['level'] == 'none'
    # four usable places is fewer than 5, so ranked peers are none
    assert recs[2]['level'] == 'none' and recs[2].get('peers') == 'few'

def test_level_cutoffs():
    assert level_of(0.85) == 'top' and level_of(0.60) == 'above'
    assert level_of(0.40) == 'typical' and level_of(0.39) == 'below'

if __name__ == '__main__':
    test_all_tied_at_top_are_top()
    test_many_tied_at_100_rank_top()
    test_thin_and_none_unchanged()
    test_level_cutoffs()
    print('assign_levels tests passed')

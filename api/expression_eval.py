from aiohttp import web

from ._common import routes


@routes.post('/comfytv/expression_eval')
async def expression_eval(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception as e:
        return web.json_response({'error': f'invalid json: {e}'}, status=400)
    expr = str(body.get('expression') or '').strip()
    if not expr:
        return web.json_response({'error': 'expression is required'},
                                 status=400)

    def num(key, default, lo, hi):
        try:
            v = float(body.get(key, default))
        except (TypeError, ValueError):
            v = default
        return min(hi, max(lo, v))

    duration = num('duration', 5.0, 0.05, 3600.0)
    fps = num('fps', 24.0, 1.0, 120.0)
    rate = num('rate', 10.0, 1.0, 60.0)
    seed = int(num('seed', 0, 0, 99999))

    from ..runners.expression import expression_samples
    try:
        samples = expression_samples(expr, duration=min(duration, 120.0),
                                     fps=fps, rate=rate, seed=seed)
    except RuntimeError as e:
        return web.json_response({'error': str(e)}, status=400)
    return web.json_response({'samples': samples})

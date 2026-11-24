// Fabrication service: public 3D printing / laser / CAD / electronics requests,
// client tracking by secret token, and the staff triage + quote back office.
import { createService } from '@fabrics/shared';
import { publicRouter } from './public.js';
import { adminRouter } from './admin.js';

const PORT = Number(process.env.FABRICATION_PORT ?? 4004);
const { app, listen } = createService('fabrication');

app.use('/admin', adminRouter);
app.use('/', publicRouter);

listen(PORT);

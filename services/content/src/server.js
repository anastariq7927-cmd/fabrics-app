// Content service: intentions (services), news, projects and partners, plus the admin back office.
import { createService } from '@fabrics/shared';
import { publicRouter } from './public.js';
import { adminRouter } from './admin.js';

const PORT = Number(process.env.CONTENT_PORT ?? 4001);
const { app, listen } = createService('content');

app.use('/admin', adminRouter);
app.use('/', publicRouter);

listen(PORT);

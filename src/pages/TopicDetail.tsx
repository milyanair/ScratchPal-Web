
import { Layout } from '@/components/layout/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import { slugifyCategory } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
